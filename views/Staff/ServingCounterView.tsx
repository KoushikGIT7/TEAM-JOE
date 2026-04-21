
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Scan, Search, LogOut, RefreshCw } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToActiveOrders, listenToPendingItems, serveItem, rejectItem, validateQRForServing, PendingItem } from '../../services/firestore-db';
import { initializeScanner, getScanner } from '../../services/scanner';
import { offlineDetector } from '../../utils/offlineDetector';
import QRScanner from '../../components/QRScanner';

interface ServingCounterViewProps {
  profile: UserProfile;
  onLogout?: () => void;
  onOpenKitchen?: () => void;
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
  userName?: string;
}

const ServingCounterView: React.FC<ServingCounterViewProps> = ({ profile, onLogout, onOpenKitchen }) => {
  const [readyItems, setReadyItems] = useState<ReadyItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);
  const [success, setSuccess] = useState<{ orderId: string; orderNumber: string; items: any[]; userName: string; qrDataRaw: string } | null>(null);
  const [servingKey, setServingKey] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PendingItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualQRInput, setManualQRInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Initialize hardware scanner
  useEffect(() => {
    console.log('🔧 Initializing hardware scanner...');
    const scanner = initializeScanner({
      suffixKey: "Enter",
      autoFocus: true,
      disableBeep: false,
    });

    scanner.onScan((data) => {
      console.log('📷 Scanner detected QR data:', data);
      handleQRScanFromScanner(data);
    });

    // Ensure scanner input is focused
    setTimeout(() => {
      const scannerInstance = getScanner();
      if (scannerInstance) {
        scannerInstance.focus();
        console.log('✅ Scanner initialized and focused');
      }
    }, 500);

    return () => {
      console.log('🧹 Cleaning up scanner...');
      scanner.destroy();
    };
  }, []);

  // Offline detection (production-grade)
  useEffect(() => {
    // Initialize with actual browser online status
    const initialOnline = navigator.onLine;
    setIsOnline(initialOnline);
    console.log('🌐 Initial network status:', initialOnline ? 'ONLINE' : 'OFFLINE');
    
    // Also check offlineDetector status
    const detectorStatus = offlineDetector.getStatus();
    console.log('🌐 OfflineDetector status:', detectorStatus);
    
    // Use the more optimistic status (if browser says online, trust it)
    if (initialOnline && detectorStatus !== 'online') {
      console.warn('⚠️ Browser says online but detector says offline - using browser status');
      setIsOnline(true);
      offlineDetector.recordPing(); // Record ping to update detector
    }
    
      const unsubscribe = offlineDetector.onStatusChange((status) => {
      // Always check navigator.onLine as fallback
      const browserOnline = navigator.onLine;
      // Use optimistic status - if browser says online, trust it
      const finalStatus = browserOnline || status === 'online';
      
      console.log('🌐 Network status change:', {
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
      console.log('✅ Browser online event detected');
      setIsOnline(true);
      offlineDetector.recordPing();
    };
    
    const handleOffline = () => {
      console.log('❌ Browser offline event detected');
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
      
      // Only process orders that have been scanned (scannedAt exists, status is ACTIVE/USED)
      orders
        .filter(order => (order.qrStatus === 'USED' || order.qrState === 'SCANNED' || order.qrStatus === 'ACTIVE') && order.scannedAt !== undefined)
        .forEach(order => {
          order.items.forEach(item => {
            const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
            if (remainingQty > 0 && item.status !== 'ABANDONED') {
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

  const handleManualSubmit = async () => {
    if (!manualQRInput.trim()) return;
    setIsManualModalOpen(false);
    await processQRScan(manualQRInput.trim());
    setManualQRInput('');
  };

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
      console.warn('⚠️ Empty QR data received from scanner');
      return;
    }
    console.log('📥 handleQRScanFromScanner called with:', qrData);
    await processQRScan(qrData);
  };

  const handleQRScan = () => {
    // Open camera by default on mobile, or provide options
    setIsCameraOpen(true);
  };

  const processQRScan = async (qrData: string) => {
    console.log('🔄 processQRScan called with:', qrData);
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
            console.log('✅ Successfully parsed JSON:', qrPayload);
          } catch (parseError: any) {
            console.error('❌ JSON parse error:', parseError);
            console.error('   Raw data:', trimmed);
            // Try parseQRPayload as fallback from qr module
            const qrModule = await import('../../services/qr');
            const parsed = qrModule.parseQRPayload(trimmed);
            if (parsed) {
              qrPayload = parsed;
              console.log('✅ Parsed using parseQRPayload:', qrPayload);
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
                console.log('✅ Parsed using parseQRPayload:', qrPayload);
              } else {
                throw new Error('Invalid QR Format - Not JSON and cannot parse');
              }
            }
      }
      
      console.log('🔍 Final QR payload:', qrPayload);
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
      console.log('📤 Calling validateQRForServing with:', qrDataString);
      console.log('   Payload type:', typeof qrPayload);
      console.log('   Stringified:', qrDataString);
      
      // Call validateQRForServing - it will parse the JSON string internally
      const order = await validateQRForServing(qrDataString, profile.uid);
      
      console.log('✅ QR Scan successful! Order:', order);
      console.log('   Order ID:', order.id);
      console.log('   Items:', order.items.length);
      
      // Show a brief success indicator instead of a giant modal that auto-hides
      setSuccess({
        orderId: order.id,
        orderNumber: order.id.slice(-8).toUpperCase(),
        userName: order.userName,
        items: order.items,
        qrDataRaw: qrDataString
      });
      
      // Clear success state after scan so user can keep scanning, 
      // but the item stays in the list because qrState is now SCANNED
      setTimeout(() => {
        setSuccess(null);
        setIsScanning(false);
        const scanner = getScanner();
        if (scanner) scanner.focus();
      }, 1500);
      
    } catch (err: any) {
      setIsScanning(false);
      console.error('❌ QR Scan Error:', err);
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
      } else if (err.message.includes('NOT_READY') || err.message.includes('pickup time')) {
        setError({ type: 'NOT_READY', message: 'Please come at your pickup time.' });
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

  const handleServeAllFromScan = async () => {
    if (!success) return;
    
    setServingKey('SERVE_ALL');
    try {
      // Serve each item individually via serveItem
      for (const item of success.items) {
        const itemId = item.id || item.itemId;
        if (itemId && item.status !== 'SERVED' && item.status !== 'ABANDONED') {
          await serveItem(success.orderId, itemId, profile.uid);
        }
      }
      setSuccess(null);
      // Main list will update via Firestore listeners
    } catch (err: any) {
      setError({ type: 'ERROR', message: err.message || 'Failed to serve all items' });
      setTimeout(() => setError(null), 3000);
    } finally {
      setServingKey(null);
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

  const handleRejectReadyItem = async (item: ReadyItem) => {
    if (servingKey) return;
    if (!window.confirm(`Are you sure you want to reject ${item.itemName}?`)) return;

    const key = `${item.orderId}_${item.itemId}`;
    setServingKey(key);
    
    try {
      await rejectItem(item.orderId, item.itemId, profile.uid);
      
      const scanner = getScanner();
      if (scanner) {
        setTimeout(() => scanner.focus(), 100);
      }
    } catch (err: any) {
      setError({ type: 'ERROR', message: err.message || 'Failed to reject item' });
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

  const handleRejectPending = async (pendingItem: PendingItem) => {
    if (servingKey) return;
    if (!window.confirm(`Are you sure you want to reject ${pendingItem.itemName}?`)) return;

    const key = `${pendingItem.orderId}_${pendingItem.itemId}`;
    setServingKey(key);
    
    try {
      await rejectItem(pendingItem.orderId, pendingItem.itemId, profile.uid);
      
      if (searchResults.some(r => r.orderId === pendingItem.orderId && r.itemId === pendingItem.itemId)) {
        setOrderSearch('');
      }
      
      const scanner = getScanner();
      if (scanner) {
        setTimeout(() => scanner.focus(), 100);
      }
    } catch (err: any) {
      setError({ type: 'ERROR', message: err.message || 'Failed to reject item' });
      setTimeout(() => setError(null), 3000);
    } finally {
      setServingKey(null);
    }
  };

  // Items are displayed individually, not grouped

  const dismissSuccess = () => {
    setSuccess(null);
    const scanner = getScanner();
    if (scanner) setTimeout(() => scanner.focus(), 50);
  };

  const dismissError = () => {
    setError(null);
    const scanner = getScanner();
    if (scanner) setTimeout(() => scanner.focus(), 50);
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden relative">
      {/* 📸 Real Camera Scanner Overlay */}
      {isCameraOpen && (
        <QRScanner 
          onScan={(data) => {
            setIsCameraOpen(false);
            processQRScan(data);
          }}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
      {/* Order confirmation panel — overlay; scanner layout stays visible underneath */}
      {/* Minimalist Scan Successful Toast */}
      {success && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top duration-300 pointer-events-none">
          <div className="bg-success text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">Token Authorized</p>
              <p className="text-xl font-black">{success.userName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error toast — fixed top, auto-dismiss; does not block layout */}
      {error && (
        <div
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[100] bg-red-600 text-white rounded-2xl shadow-2xl border-2 border-red-700 p-4 flex items-start gap-3"
            style={{ animation: 'slideDown 0.2s ease-out' }}
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 text-red-200" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-wide text-red-100">
              {error.type === 'USED' ? 'Already used' : error.type === 'PAYMENT' ? 'Payment invalid' : error.type === 'INVALID' ? 'Invalid QR' : error.type === 'COMPLETED' ? 'Order completed' : error.type === 'EXPIRED' ? 'QR expired' : error.type === 'NOT_READY' ? 'Not ready' : 'Error'}
            </p>
            <p className="text-base font-bold mt-0.5">{error.message}</p>
          </div>
          <button
            onClick={dismissError}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 font-black text-sm uppercase active:scale-95 transition-all flex-shrink-0"
            aria-label="Dismiss"
          >
            OK
          </button>
        </div>
      )}

      {/* Manual QR entry modal (opened via floating scan button) */}
      {isManualModalOpen && (
        <div
          className="absolute inset-0 z-[90] flex items-center justify-center bg-black/40 px-4"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-2 flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              Enter / Scan QR Code
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Use the handheld scanner or paste the QR token data here. Items will appear after a successful scan.
            </p>
            <textarea
              value={manualQRInput}
              onChange={(e) => setManualQRInput(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary"
              placeholder="Paste QR token (JSON or encoded string)…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 active:scale-95"
                onClick={() => {
                  setIsManualModalOpen(false);
                  setManualQRInput('');
                  const scanner = getScanner();
                  if (scanner) setTimeout(() => scanner.focus(), 100);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary/90 active:scale-95 disabled:opacity-60"
                disabled={!manualQRInput.trim() || isScanning}
                onClick={async () => {
                  if (!manualQRInput.trim()) return;
                  await processQRScan(manualQRInput);
                  // processQRScan will manage isScanning and focus; keep modal open only on error
                  setIsManualModalOpen(false);
                  setManualQRInput('');
                }}
              >
                Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar — compact on mobile */}
      <header className="bg-white border-b-2 sm:border-b-4 border-gray-300 px-3 py-2 sm:p-4 flex flex-row items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black text-gray-900 truncate">JOE</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <span className="text-sm sm:text-lg lg:text-xl font-black text-gray-800 tabular-nums">
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
          {onOpenKitchen && (
            <button
              onClick={onOpenKitchen}
              className="min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-4 bg-amber-500 hover:bg-amber-600 text-white p-2 sm:py-2.5 sm:px-4 rounded-xl text-sm font-black uppercase tracking-wider shadow active:scale-95 transition-transform flex items-center justify-center"
              title="Kitchen"
              aria-label="Kitchen"
            >
              <span className="hidden md:inline">KITCHEN</span>
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-4 bg-red-500 hover:bg-red-600 text-white p-2 sm:py-2.5 sm:px-4 rounded-xl text-sm font-black uppercase tracking-wider shadow active:scale-95 transition-transform flex items-center justify-center"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline ml-1">LOGOUT</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Layout — mobile: single column (Ready first); tablet+: two columns */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* LEFT — READY TO SERVE (primary on all sizes) */}
        <section
          className="w-full md:w-2/3 flex flex-col bg-white overflow-hidden border-b-2 md:border-b-0 md:border-r-2 border-gray-200 flex-shrink-0 md:min-w-0"
          aria-label="Ready to serve queue"
        >
          <div className="bg-green-500 text-white px-3 py-2.5 sm:p-4 border-b-2 border-green-600 sticky top-0 z-10 flex items-center justify-between flex-shrink-0">
            <h2 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-wider">Ready to serve</h2>
            <span className="flex items-center gap-1.5 text-green-100 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-green-200 animate-pulse" aria-hidden />
              Scan active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
            {readyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] sm:min-h-[280px] text-center px-4">
                <div className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-green-300 rounded-2xl flex items-center justify-center bg-green-50/50 mb-3 sm:mb-4">
                  <Scan className="w-10 h-10 sm:w-14 sm:h-14 text-green-400" />
                </div>
                <p className="text-lg sm:text-xl font-black text-gray-500">Scan QR to start</p>
                <p className="text-sm text-gray-400 mt-1">Items appear here after scan</p>
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

                return Object.entries(groupedByOrder).map(([orderNumber, items]) => {
                  const firstItem = items[0];
                  return (
                    <div key={orderNumber} className="bg-white rounded-3xl p-4 sm:p-6 lg:p-8 border-4 border-green-500 shadow-2xl animate-in zoom-in-95 duration-300">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-green-100">
                        <div className="text-center sm:text-left">
                           <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Customer Token</p>
                           <h3 className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{firstItem.userName}</h3>
                        </div>
                        <div className="bg-black text-white px-5 py-2 rounded-2xl">
                          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Order Ref</p>
                          <p className="text-lg font-black tabular-nums">#{orderNumber}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {(items as ReadyItem[]).map((item) => {
                          const key = `${item.orderId}_${item.itemId}`;
                          const isServing = servingKey === key;

                          return (
                            <div
                              key={key}
                              className="flex flex-col lg:flex-row items-center gap-6 bg-gray-50 rounded-3xl p-4 sm:p-6 border-2 border-green-200 hover:border-green-400 transition-colors"
                            >
                              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-[2rem] overflow-hidden shadow-xl border-4 border-white flex-shrink-0">
                                <img
                                  src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop'}
                                  alt={item.itemName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 text-center lg:text-left min-w-0 w-full">
                                <h4 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-2 leading-tight tracking-tight">{item.itemName}</h4>
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                                   <div className="bg-white px-4 py-2 rounded-xl border border-gray-200">
                                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">To Serve</p>
                                      <p className="text-3xl font-black text-green-600">{item.remainingQty}</p>
                                   </div>
                                   <div className="bg-white px-4 py-2 rounded-xl border border-gray-200">
                                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Order</p>
                                      <p className="text-3xl font-black text-gray-300">{item.orderedQty}</p>
                                   </div>
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 w-full lg:w-auto">
                                <button
                                  onClick={() => handleServeReadyItem(item)}
                                  disabled={isServing}
                                  className="w-full lg:w-auto min-h-[80px] lg:min-w-[150px] bg-green-500 hover:bg-green-600 active:scale-[0.98] text-white px-6 py-4 rounded-[1.5rem] text-xl sm:text-2xl font-black uppercase tracking-widest shadow-xl shadow-green-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {isServing ? (
                                    <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
                                  ) : (
                                    <><CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" /> Serve</>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectReadyItem(item)}
                                  disabled={isServing}
                                  className="w-full lg:w-auto min-h-[60px] lg:min-w-[100px] bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white px-4 py-3 rounded-[1.5rem] text-sm sm:text-base font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </section>

        {/* RIGHT — PENDING ITEMS & SEARCH (tablet+: side panel) */}
        <section
          className="w-full md:w-1/3 flex flex-col bg-amber-50/80 overflow-hidden border-t-2 md:border-t-0 md:border-l-2 border-amber-200 flex-shrink-0 md:min-w-0"
          aria-label="Pending items"
        >
          <div className="bg-amber-500 text-white px-3 py-2.5 sm:p-4 border-b-2 border-amber-600 sticky top-0 z-10 flex-shrink-0">
            <h2 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-wider text-center">Pending</h2>
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
                      <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleServePending(pendingItem)}
                          disabled={isServing}
                          className="min-h-[48px] bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white px-4 sm:px-5 py-3 rounded-xl text-sm sm:text-base font-black uppercase tracking-wider shadow-lg transition-transform disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 w-full sm:min-w-[120px] touch-manipulation"
                          aria-label={isServing ? 'Serving' : `Serve ${pendingItem.itemName}`}
                        >
                          {isServing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                          {isServing ? 'Serving' : 'Serve'}
                        </button>
                        <button
                          onClick={() => handleRejectPending(pendingItem)}
                          disabled={isServing}
                          className="min-h-[40px] bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-md transition-transform disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 w-full sm:min-w-[120px]"
                          aria-label={`Reject ${pendingItem.itemName}`}
                        >
                          Reject
                        </button>
                      </div>
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
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleServePending(pendingItem)}
                        disabled={isServing}
                        className="min-h-[48px] bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white px-4 sm:px-5 py-3 rounded-xl text-sm sm:text-base font-black uppercase tracking-wider shadow-lg transition-transform disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 w-full sm:min-w-[120px] touch-manipulation"
                        aria-label={isServing ? 'Serving' : `Serve ${pendingItem.itemName}`}
                      >
                        {isServing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                        {isServing ? 'Serving' : 'Serve'}
                      </button>
                      <button
                        onClick={() => handleRejectPending(pendingItem)}
                        disabled={isServing}
                        className="min-h-[40px] bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-md transition-transform disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 w-full sm:min-w-[120px]"
                        aria-label={`Reject ${pendingItem.itemName}`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Manual QR Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsManualModalOpen(false)} />
          <div className="bg-white rounded-[2rem] w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900">Manual Entry</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="p-2 bg-gray-100 rounded-xl">
                <AlertCircle className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500">Enter the QR code payload manually from the student screen.</p>
              <textarea
                value={manualQRInput}
                onChange={(e) => setManualQRInput(e.target.value)}
                placeholder="Paste or type QR payload..."
                className="w-full h-32 bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-mono text-xs focus:border-primary focus:ring-0 outline-none transition-all"
                autoFocus
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualQRInput.trim() || isScanning}
                className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {isScanning ? 'Processing...' : 'Verify Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating scan choice trigger */}
      <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 md:bottom-6 md:right-6 z-50 flex flex-col gap-3">
        {/* Manual Button */}
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="min-h-[48px] min-w-[48px] sm:min-h-[56px] sm:min-w-[56px] bg-white text-gray-600 rounded-full shadow-lg active:scale-90 transition-all flex items-center justify-center border-2 border-gray-200"
          title="Manual entry"
        >
          <Search className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        
        {/* Main Scan Button */}
        <button
          onClick={handleQRScan}
          disabled={isScanning}
          className="min-h-[64px] min-w-[64px] sm:min-h-[80px] sm:min-w-[80px] bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl active:scale-95 transition-transform flex items-center justify-center border-4 border-white touch-manipulation disabled:opacity-60"
          title="Open Camera"
          aria-label={isScanning ? 'Scanning' : 'Open Camera'}
        >
          {isScanning ? (
            <span className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Scan className="w-8 h-8 sm:w-10 sm:h-10" />
          )}
        </button>
      </div>

    </div>
  );
};

export default ServingCounterView;
