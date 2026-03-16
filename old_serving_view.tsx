
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Scan, Search, LogOut } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToActiveOrders, listenToPendingItems, serveItem, validateQRForServing, PendingItem } from '../../services/firestore-db';
import { initializeScanner, getScanner } from '../../services/scanner';
import { offlineDetector } from '../../utils/offlineDetector';
import SyncStatus from '../../components/SyncStatus';

interface ServingCounterViewProps {
  profile: UserProfile;
  onLogout?: () => void;
}

interface ReadyItem {
  orderId: string;
  orderNumber: string;
  itemId: string;
  itemName: string;
  imageUrl: string;
  remainingQty: number;
  orderedQty: number;
  servedQty: number;
}

const ServingCounterView: React.FC<ServingCounterViewProps> = ({ profile, onLogout }) => {
  const [readyItems, setReadyItems] = useState<ReadyItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);
  const [success, setSuccess] = useState<{ orderId: string; orderNumber: string; items: string[] } | null>(null);
  const [servingKey, setServingKey] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PendingItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Initialize hardware scanner
  useEffect(() => {
    console.log('­ƒöº Initializing hardware scanner...');
    const scanner = initializeScanner({
      suffixKey: "Enter",
      autoFocus: true,
      disableBeep: false,
    });

    scanner.onScan((data) => {
      console.log('­ƒôÀ Scanner detected QR data:', data);
      handleQRScanFromScanner(data);
    });

    // Ensure scanner input is focused
    setTimeout(() => {
      const scannerInstance = getScanner();
      if (scannerInstance) {
        scannerInstance.focus();
        console.log('Ô£à Scanner initialized and focused');
      }
    }, 500);

    return () => {
      console.log('­ƒº╣ Cleaning up scanner...');
      scanner.destroy();
    };
  }, []);

  // Offline detection (production-grade)
  useEffect(() => {
    // Initialize with actual browser online status
    const initialOnline = navigator.onLine;
    setIsOnline(initialOnline);
    console.log('­ƒîÉ Initial network status:', initialOnline ? 'ONLINE' : 'OFFLINE');
    
    // Also check offlineDetector status
    const detectorStatus = offlineDetector.getStatus();
    console.log('­ƒîÉ OfflineDetector status:', detectorStatus);
    
    // Use the more optimistic status (if browser says online, trust it)
    if (initialOnline && detectorStatus !== 'online') {
      console.warn('ÔÜá´©Å Browser says online but detector says offline - using browser status');
      setIsOnline(true);
      offlineDetector.recordPing(); // Record ping to update detector
    }
    
      const unsubscribe = offlineDetector.onStatusChange((status) => {
      // Always check navigator.onLine as fallback
      const browserOnline = navigator.onLine;
      // Use optimistic status - if browser says online, trust it
      const finalStatus = browserOnline || status === 'online';
      
      console.log('­ƒîÉ Network status change:', {
        detector: status,
        browser: browserOnline ? 'online' : 'offline',
        final: finalStatus ? 'online' : 'offline'
      });
      
      setIsOnline(finalStatus);
      
      // Record ping when status changes to online
      if (finalStatus) {
        offlineDetector.recordPing();
      }
    });

    // Also listen to browser online/offline events
    const handleOnline = () => {
      console.log('Ô£à Browser online event detected');
      setIsOnline(true);
      offlineDetector.recordPing();
    };
    
    const handleOffline = () => {
      console.log('ÔØî Browser offline event detected');
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to active orders and extract ready items (ONLY from scanned orders)
  useEffect(() => {
    const unsubscribe = listenToActiveOrders((orders) => {
      const ready: ReadyItem[] = [];
      
      // Only process orders that have been scanned (qrStatus = USED, scannedAt exists)
      orders
        .filter(order => order.qrStatus === 'USED' && order.scannedAt !== undefined)
        .forEach(order => {
          order.items.forEach(item => {
            const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
            if (remainingQty > 0) {
              ready.push({
                orderId: order.id,
                orderNumber: order.id.slice(-8).toUpperCase(),
                itemId: item.id,
                itemName: item.name,
                imageUrl: item.imageUrl,
                remainingQty,
                orderedQty: item.quantity,
                servedQty: item.servedQty || 0
              });
            }
          });
        });
      
      setReadyItems(ready);
    });
    return unsubscribe;
  }, []);

  // Listen to pending items
  useEffect(() => {
    const unsubscribe = listenToPendingItems((items) => {
      setPendingItems(items);
    });
    return unsubscribe;
  }, []);

  // Search pending items by order number
  useEffect(() => {
    if (orderSearch.trim()) {
      const search = orderSearch.trim().toUpperCase();
      const results = pendingItems.filter(item => 
        item.orderNumber.includes(search)
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [orderSearch, pendingItems]);

  const handleQRScanFromScanner = async (qrData: string) => {
    if (!qrData || !qrData.trim()) {
      console.warn('ÔÜá´©Å Empty QR data received from scanner');
      return;
    }
    console.log('­ƒôÑ handleQRScanFromScanner called with:', qrData);
    await processQRScan(qrData);
  };

  const handleQRScan = async () => {
    // Fallback for manual input (testing/debugging)
    const qrData = prompt("SCAN QR CODE\nPaste QR token data (JSON format):");
    if (!qrData || !qrData.trim()) {
      console.log('ÔÜá´©Å No QR data provided');
      return;
    }
    console.log('­ƒôï Manual QR scan triggered with:', qrData);
    await processQRScan(qrData);
  };

  const processQRScan = async (qrData: string) => {
    console.log('­ƒöä processQRScan called with:', qrData);
    console.log('   Data type:', typeof qrData);
    console.log('   Data length:', qrData?.length);

    setIsScanning(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Handle QR data - can be JSON string or already parsed
      let qrPayload: any = qrData;
      
      // Try to parse as JSON if it's a string
      if (typeof qrData === 'string') {
        const trimmed = qrData.trim();
        console.log('   Trimmed data:', trimmed);
        console.log('   Starts with {:', trimmed.startsWith('{'));
        
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            qrPayload = JSON.parse(trimmed);
            console.log('Ô£à Successfully parsed JSON:', qrPayload);
          } catch (parseError: any) {
            console.error('ÔØî JSON parse error:', parseError);
            console.error('   Raw data:', trimmed);
            // Try parseQRPayload as fallback from qr module
            const qrModule = await import('../../services/qr');
            const parsed = qrModule.parseQRPayload(trimmed);
            if (parsed) {
              qrPayload = parsed;
              console.log('Ô£à Parsed using parseQRPayload:', qrPayload);
            } else {
              throw new Error(`Invalid QR Format - Cannot parse: ${parseError.message}`);
            }
          }
            } else {
              // Not JSON, try parseQRPayload from qr module
              const { parseQRPayload } = await import('../../services/qr');
              const parsed = parseQRPayload(trimmed);
              if (parsed) {
                qrPayload = parsed;
                console.log('Ô£à Parsed using parseQRPayload:', qrPayload);
              } else {
                throw new Error('Invalid QR Format - Not JSON and cannot parse');
              }
            }
      }
      
      console.log('­ƒöì Final QR payload:', qrPayload);
      console.log('   OrderId:', qrPayload?.orderId);
      console.log('   UserId:', qrPayload?.userId);
      
      // Validate payload structure
      if (!qrPayload || typeof qrPayload !== 'object') {
        throw new Error('Invalid QR Format - Payload is not an object');
      }
      
      if (!qrPayload.orderId) {
        throw new Error('Invalid QR Format - Missing orderId');
      }
      
      // Scan and get order details - validateQRForServing expects string (JSON stringified)
      const qrDataString = typeof qrPayload === 'string' ? qrPayload : JSON.stringify(qrPayload);
      console.log('­ƒôñ Calling validateQRForServing with:', qrDataString);
      console.log('   Payload type:', typeof qrPayload);
      console.log('   Stringified:', qrDataString);
      
      // Call validateQRForServing - it will parse the JSON string internally
      const order = await validateQRForServing(qrDataString);
      
      console.log('Ô£à QR Scan successful! Order:', order);
      console.log('   Order ID:', order.id);
      console.log('   Items:', order.items.length);
      
      // Show success message with order details
      setSuccess({
        orderId: order.id,
        orderNumber: order.id.slice(-8).toUpperCase(),
        items: order.items.map(item => `${item.name} x${item.quantity}`)
      });
      
      // Auto-hide success after 3 seconds
      setTimeout(() => {
        setSuccess(null);
        setIsScanning(false);
        // Refocus scanner for next scan
        const scanner = getScanner();
        if (scanner) {
          setTimeout(() => scanner.focus(), 100);
        }
      }, 3000);
      
    } catch (err: any) {
      setIsScanning(false);
      console.error('ÔØî QR Scan Error:', err);
      console.error('   Error message:', err.message);
      console.error('   Error stack:', err.stack);
      
      // Handle specific error types
      if (err.message.includes('TOKEN_ALREADY_USED') || err.message.includes('Already Used')) {
        setError({ type: 'USED', message: 'QR Already Used' });
      } else if (err.message.includes('PAYMENT_NOT_VERIFIED')) {
        setError({ type: 'PAYMENT', message: 'Payment Not Valid' });
      } else if (err.message.includes('Invalid Token') || err.message.includes('Invalid QR')) {
        setError({ type: 'INVALID', message: err.message || 'Invalid QR Code' });
      } else if (err.message.includes('Order not found') || err.message.includes('Network Error')) {
        setError({ type: 'ERROR', message: err.message || 'Order not found. Please ensure order exists and payment is confirmed.' });
      } else if (err.message.includes('Already Completed')) {
        setError({ type: 'COMPLETED', message: 'Order Already Completed' });
      } else if (err.message.includes('QR_CODE_EXPIRED') || err.message.includes('expired')) {
        setError({ type: 'EXPIRED', message: 'QR Code Expired' });
      } else {
        setError({ type: 'ERROR', message: err.message || 'Scan Failed - Check console for details' });
      }
      setTimeout(() => setError(null), 5000);
      
      // Refocus scanner after error
      const scanner = getScanner();
      if (scanner) {
        setTimeout(() => {
          scanner.focus();
          setIsScanning(false);
        }, 100);
      }
    }
  };

  const handleServeReadyItem = async (item: ReadyItem) => {
    if (servingKey) return;

    const key = `${item.orderId}_${item.itemId}`;
    setServingKey(key);
    
    try {
      await serveItem(item.orderId, item.itemId, profile.uid);
      
      // Refocus scanner for next action
      const scanner = getScanner();
      if (scanner) {
        setTimeout(() => scanner.focus(), 100);
      }
    } catch (err: any) {
      setError({ type: 'ERROR', message: err.message || 'Failed to serve item' });
      setTimeout(() => setError(null), 3000);
    } finally {
      setServingKey(null);
    }
  };

  const handleServePending = async (pendingItem: PendingItem) => {
    if (servingKey) return;

    const key = `${pendingItem.orderId}_${pendingItem.itemId}`;
    setServingKey(key);
    
    try {
      await serveItem(pendingItem.orderId, pendingItem.itemId, profile.uid);
      
      // Clear search if item was from search results
      if (searchResults.some(r => r.orderId === pendingItem.orderId && r.itemId === pendingItem.itemId)) {
        setOrderSearch('');
      }
      
      // Refocus scanner
      const scanner = getScanner();
      if (scanner) {
        setTimeout(() => scanner.focus(), 100);
      }
    } catch (err: any) {
      setError({ type: 'ERROR', message: err.message || 'Failed to serve item' });
      setTimeout(() => setError(null), 3000);
    } finally {
      setServingKey(null);
    }
  };

  // Items are displayed individually, not grouped

  // Show success screen with order details
  if (success) {
    return (
      <div className="h-screen w-screen bg-green-600 flex flex-col items-center justify-center text-white p-4 sm:p-6 lg:p-8">
        <CheckCircle className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 mb-4 sm:mb-6 lg:mb-8 animate-pulse" />
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-7xl font-black mb-4 sm:mb-6 uppercase tracking-wider text-center">
          QR SCANNED
        </h1>
        <div className="bg-white/20 backdrop-blur rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 max-w-2xl w-full">
          <div className="bg-black/30 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl mb-4 sm:mb-6 text-center">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-300 mb-1">ORDER NO</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-black">#{success.orderNumber}</p>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <p className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-wider mb-3 sm:mb-4">Order Items:</p>
            {success.items.map((item, index) => (
              <div key={index} className="bg-white/10 rounded-xl p-3 sm:p-4 text-left">
                <p className="text-base sm:text-lg lg:text-xl font-black">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-center mb-4 sm:mb-6 lg:mb-8 px-4">Order loaded to serving queue</p>
        <button
          onClick={() => {
            setSuccess(null);
            const scanner = getScanner();
            if (scanner) scanner.focus();
          }}
          className="mt-4 sm:mt-6 lg:mt-8 bg-white text-green-600 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 rounded-2xl sm:rounded-3xl text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider active:scale-95 transition-all shadow-2xl"
        >
          CONTINUE
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-red-600 flex flex-col items-center justify-center text-white p-4 sm:p-6 lg:p-8">
        <AlertCircle className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 mb-4 sm:mb-6 lg:mb-8 animate-pulse" />
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-7xl font-black mb-4 sm:mb-6 uppercase tracking-wider text-center px-4">
          {error.type === 'USED' ? 'ALREADY USED' : 
           error.type === 'PAYMENT' ? 'PAYMENT INVALID' : 
           error.type === 'INVALID' ? 'INVALID QR' : 
           error.type === 'COMPLETED' ? 'ORDER COMPLETED' : 
           error.type === 'EXPIRED' ? 'QR EXPIRED' :
           'NETWORK ERROR'}
        </h1>
        <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-center mb-4 sm:mb-6 lg:mb-8 px-4">{error.message}</p>
        <button
          onClick={() => {
            setError(null);
            const scanner = getScanner();
            if (scanner) scanner.focus();
          }}
          className="mt-4 sm:mt-6 lg:mt-8 bg-white text-red-600 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 rounded-2xl sm:rounded-3xl text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider active:scale-95 transition-all shadow-2xl"
        >
          CONTINUE
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b-4 border-gray-300 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 flex-shrink-0">
        <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900">JOE CAFETERIA</h1>
          <SyncStatus showLabel={true} />
        </div>
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 w-full sm:w-auto justify-end">
          <div className="text-lg sm:text-xl lg:text-3xl font-black text-gray-800">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase()}
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 sm:px-6 py-2 sm:py-4 rounded-xl text-sm sm:text-lg font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">LOGOUT</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDE - READY TO SERVE QUEUE */}
        <div className="w-full lg:w-2/3 border-r-0 lg:border-r-4 border-gray-300 flex flex-col bg-white overflow-y-auto">
          <div className="bg-green-500 text-white p-3 sm:p-4 border-b-4 border-green-600 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider">READY TO SERVE</h2>
            </div>
          </div>

          <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
            {readyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 border-4 sm:border-6 lg:border-8 border-green-300 rounded-2xl flex items-center justify-center bg-gray-50 mb-4 sm:mb-6 lg:mb-8">
                  <Scan className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 text-green-300" />
                </div>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-400">SCAN QR TO START</p>
                <p className="text-lg sm:text-xl lg:text-2xl text-gray-500 mt-2 sm:mt-4">Items will appear here after QR scan</p>
              </div>
            ) : (
              (() => {
                // Group items by order number
                const groupedByOrder = readyItems.reduce((acc, item) => {
                  if (!acc[item.orderNumber]) {
                    acc[item.orderNumber] = [];
                  }
                  acc[item.orderNumber].push(item);
                  return acc;
                }, {} as Record<string, ReadyItem[]>);

                return Object.entries(groupedByOrder).map(([orderNumber, items]) => (
                  <div key={orderNumber} className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border-2 sm:border-4 border-green-400 shadow-lg">
                    <div className="bg-black text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl mb-3 sm:mb-4 text-center">
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-300 mb-1">ORDER NO</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-black">#{orderNumber}</p>
                    </div>
                    
                    <div className="space-y-2 sm:space-y-3">
                      {items.map((item) => {
                        const key = `${item.orderId}_${item.itemId}`;
                        const isServing = servingKey === key;

                        return (
                          <div
                            key={key}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-white rounded-xl p-3 sm:p-4 border-2 border-green-300"
                          >
                            <img
                              src={item.imageUrl || 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400'}
                              alt={item.itemName}
                              className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-cover rounded-lg shadow-md flex-shrink-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';
                              }}
                            />
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-gray-800 mb-1 break-words">{item.itemName}</h3>
                              <p className="text-sm sm:text-base lg:text-lg text-gray-600">
                                Ordered: {item.orderedQty} | Served: {item.servedQty} | <span className="text-orange-600 font-black">Left: {item.remainingQty}</span>
                              </p>
                            </div>
                            <button
                              onClick={() => handleServeReadyItem(item)}
                              disabled={isServing}
                              className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 rounded-xl text-base sm:text-lg lg:text-xl font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[140px]"
                            >
                              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                              {isServing ? 'SERVING...' : 'SERVE'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </div>

        {/* RIGHT SIDE - PENDING ITEMS & SEARCH */}
        <div className="w-full lg:w-1/3 flex flex-col bg-amber-50 overflow-y-auto border-t-4 lg:border-t-0 border-amber-300">
          <div className="bg-amber-500 text-white p-3 sm:p-4 text-center border-b-4 border-amber-600 sticky top-0 z-10">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider">PENDING ITEMS</h2>
          </div>

          {/* Order Number Search */}
          <div className="p-3 sm:p-4 bg-white border-b-4 border-amber-300">
            <div className="flex items-center gap-2 sm:gap-3 bg-gray-100 rounded-xl p-2 sm:p-3">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search Order #"
                className="flex-1 bg-transparent text-base sm:text-lg lg:text-xl font-black text-gray-800 outline-none placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 p-3 sm:p-4 space-y-2 sm:space-y-3 overflow-y-auto">
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-3 sm:mb-4">
                <p className="text-base sm:text-lg font-black text-amber-700 mb-2">SEARCH RESULTS</p>
                {searchResults.map((pendingItem) => {
                  const key = `${pendingItem.orderId}_${pendingItem.itemId}`;
                  const isServing = servingKey === key;

                  return (
                    <div
                      key={key}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-xl p-3 sm:p-4 border-2 sm:border-4 border-amber-400 shadow-lg mb-2 sm:mb-3"
                    >
                      <img
                        src={pendingItem.imageUrl || 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400'}
                        alt={pendingItem.itemName}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shadow-sm flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';
                        }}
                      />
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <h3 className="text-base sm:text-lg lg:text-xl font-black text-gray-800 mb-1 break-words">{pendingItem.itemName}</h3>
                        <p className="text-sm sm:text-base lg:text-lg font-black text-gray-600">Order #{pendingItem.orderNumber}</p>
                        <p className="text-base sm:text-lg lg:text-xl font-black text-amber-600">Left: {pendingItem.remainingQty}</p>
                      </div>
                      <button
                        onClick={() => handleServePending(pendingItem)}
                        disabled={isServing}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl text-sm sm:text-base lg:text-lg font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[120px]"
                      >
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        {isServing ? 'SERVING...' : 'SERVE'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* All Pending Items */}
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 border-2 sm:border-3 lg:border-4 border-amber-300 rounded-xl sm:rounded-2xl flex items-center justify-center bg-white mb-4 sm:mb-6">
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 text-amber-300" />
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-400">NO PENDING ITEMS</p>
              </div>
            ) : (
              pendingItems.map((pendingItem) => {
                const key = `${pendingItem.orderId}_${pendingItem.itemId}`;
                const isServing = servingKey === key;
                const isInSearch = searchResults.some(r => r.orderId === pendingItem.orderId && r.itemId === pendingItem.itemId);

                if (isInSearch) return null; // Already shown in search results

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-xl p-3 sm:p-4 border-2 sm:border-4 border-amber-400 shadow-md"
                  >
                    <img
                      src={pendingItem.imageUrl || 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400'}
                      alt={pendingItem.itemName}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shadow-sm flex-shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';
                      }}
                    />
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <h3 className="text-base sm:text-lg lg:text-xl font-black text-gray-800 mb-1 break-words">{pendingItem.itemName}</h3>
                      <p className="text-sm sm:text-base lg:text-lg font-black text-gray-600">Order #{pendingItem.orderNumber}</p>
                      <p className="text-base sm:text-lg lg:text-xl font-black text-amber-600">Left: {pendingItem.remainingQty}</p>
                    </div>
                    <button
                      onClick={() => handleServePending(pendingItem)}
                      disabled={isServing}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl text-sm sm:text-base lg:text-lg font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[120px]"
                    >
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      {isServing ? 'SERVING...' : 'SERVE'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Floating Scan Button (Always Visible for Crowd Management) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:bottom-8 lg:right-8 z-50">
        <button
          onClick={handleQRScan}
          disabled={isScanning}
          className={`bg-primary hover:bg-primary/90 text-white w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center border-2 sm:border-3 lg:border-4 border-white ${
            isScanning ? 'animate-spin' : 'animate-pulse'
          } disabled:opacity-50`}
          title={isScanning ? "Scanning in progress..." : "Scan QR Code - Click to manually enter QR data"}
        >
          <Scan className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12" />
        </button>
        {isScanning && (
          <div className="absolute -top-10 sm:-top-12 left-1/2 -translate-x-1/2 bg-black/80 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-black whitespace-nowrap">
            SCANNING...
          </div>
        )}
      </div>

      {/* Scanner input is created by scanner service - no need for duplicate */}
    </div>
  );
};

export default ServingCounterView;
