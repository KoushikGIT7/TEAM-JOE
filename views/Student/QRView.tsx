
import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, CheckCircle2, Info, Share2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder } from '../../services/firestore-db';
import { Order } from '../../types';
import { shouldShowQR, getOrderStatusMessage, getOrderUIState } from '../../utils/orderLifecycle';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import SyncStatus from '../../components/SyncStatus';
import { useMotivationalHeadline } from '../../hooks/useMotivationalHeadline';
import MotivationalHeadline from '../../components/MotivationalHeadline';
import QuoteDisplay from '../../components/QuoteDisplay';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
}

const QRView: React.FC<QRViewProps> = ({ orderId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrGeneratedRef = useRef(false);
  const { visible: loadingHeadlineVisible, headline: loadingHeadline } = useMotivationalHeadline(loading);
  const [orderCount, setOrderCount] = useState<number>(1);

  // Auto-redirect on rejection
  useEffect(() => {
    if (order?.orderStatus === 'REJECTED') {
      const timer = setTimeout(onBack, 3000);
      return () => clearTimeout(timer);
    }
  }, [order?.orderStatus, onBack]);

  // Initialize or increment standard orderCount simulator since we don't have this in the DB yet
  useEffect(() => {
    if (!orderId) return;
    const history = JSON.parse(localStorage.getItem('joe_order_history') || '[]');
    if (!history.includes(orderId)) {
      history.push(orderId);
      localStorage.setItem('joe_order_history', JSON.stringify(history));
    }
    setOrderCount(history.length);
  }, [orderId]);

  useEffect(() => {
    console.log('📱 QRView: Setting up real-time listener for order:', orderId);
    const unsubscribe = listenToOrder(orderId, (data) => {
      console.log('📱 QRView: Real-time order update:', {
        orderId: data?.id,
        paymentStatus: data?.paymentStatus,
        qrStatus: data?.qrStatus,
        orderStatus: data?.orderStatus,
        uiState: data ? getOrderUIState(data) : 'unknown'
      });
      
      setOrder(data);
      setLoading(false);
      
      if (!data) {
        console.warn('⚠️ QRView: Order not found');
        setQrString(null);
        return;
      }

      // QR should be shown ONLY when: paymentStatus === SUCCESS && qrStatus === ACTIVE && orderStatus === ACTIVE
      if (shouldShowQR(data)) {
        // Prefer persisted Firestore token (durable across refresh/devices)
        if (data.qr?.token) {
          console.log('✅ QRView: Using persisted QR token from Firestore');
          setQrString(data.qr.token);
          qrGeneratedRef.current = true;
          return;
        }

        // Generate instantly using sync version if missing
        if (!qrGeneratedRef.current) {
          console.log('🎨 QRView: Generating QR code instantly for order:', data.id);
          try {
            const { generateQRPayloadSync } = require('../../services/qr');
            const qr = generateQRPayloadSync(data);
            setQrString(qr);
            qrGeneratedRef.current = true;
            console.log('✅ QRView: QR code generated instantly');
            
            // Persist to Firestore asynchronously (non-blocking)
            (async () => {
              try {
                await updateDoc(doc(db, 'orders', data.id), {
                  qr: { token: qr, status: 'ACTIVE', createdAt: serverTimestamp() }
                });
                console.log('✅ QRView: QR persisted to Firestore');
              } catch (err) {
                console.warn('⚠️ QRView: Failed to persist QR (non-blocking):', err);
              }
            })();
          } catch (err) {
            console.error('❌ QRView: Sync QR generation failed:', err);
            setQrString(null);
          }
        }
      } else {
        // QR should NOT be shown - order state doesn't support it
        console.log('📍 QRView: QR not applicable for this order state', {
          paymentStatus: data.paymentStatus,
          qrStatus: data.qrStatus,
          orderStatus: data.orderStatus
        });
        setQrString(null);
      }
    });
    
    return unsubscribe;
  }, [orderId]);

  if (loading) {
    return (
      <div className="relative h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <MotivationalHeadline
          visible={loadingHeadlineVisible}
          headline={loadingHeadline}
          variant="overlay"
        />
      </div>
    );
  }
  
  if (!order) return <div className="p-10 text-center">Order not found.</div>;

  const uiState = getOrderUIState(order);
  const qrIsVisible = shouldShowQR(order) && qrString !== null;
  const isScanned = uiState === 'SCANNED';

  // 📍 Real-time status check: if order was rejected
  if (order.orderStatus === 'REJECTED') {
    return (
      <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
        <div className="p-4 bg-white flex items-center gap-4 border-b">
          <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-textMain">Order Rejected</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Order Rejected</h3>
          <p className="text-gray-600 mb-8 font-medium">Please contact the cashier for assistance.</p>
          
          <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm text-gray-500 mb-8">
            Redirecting to home in 3 seconds...
          </div>

          <button 
            onClick={onBack}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            Go Home Now
          </button>
        </div>
      </div>
    );
  }

  // 📍 Real-time status check: if QR was scanned, show confirmation
  if (isScanned) {
    return (
      <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
        <div className="p-4 bg-white flex items-center gap-4 border-b">
          <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-textMain">Order Status</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-success mb-4" />
          <h3 className="text-xl font-bold text-textMain mb-2">Order Accepted!</h3>
          <p className="text-textSecondary mb-4">Your order has been scanned and is being prepared.</p>
          {order.kitchenStatus === 'READY' && (
            <p className="text-primary font-bold mb-2 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Ready for pickup
            </p>
          )}
          {order.kitchenStatus && order.kitchenStatus !== 'READY' && order.kitchenStatus !== 'SERVED' && (
            <p className="text-textSecondary text-sm mb-2">Status: {order.kitchenStatus === 'COOKING' ? 'Cooking' : 'Placed'}</p>
          )}
          <p className="text-sm text-textSecondary mb-8">Scanned at: {order.scannedAt ? new Date(order.scannedAt).toLocaleTimeString() : 'N/A'}</p>
          <button 
            onClick={onBack}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-95 transition-all"
          >
            View Orders
          </button>
        </div>
      </div>
    );
  }

  // 📍 Real-time status check: if payment pending
  if (order.paymentStatus !== 'SUCCESS') {
    return (
      <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
        <div className="p-4 bg-white flex items-center gap-4 border-b">
          <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-textMain">Meal Token</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-16 h-16 text-error mb-4" />
          <h3 className="text-xl font-bold text-textMain mb-2">Payment Pending</h3>
          <p className="text-textSecondary">QR code will be available after payment is confirmed.</p>
          <button 
            onClick={onBack}
            className="mt-8 w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-95 transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // 📍 Loading QR
  if (!qrIsVisible && loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // 📍 Main QR display (only shown when qrIsVisible)
  return (
    <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
      {/* Header */}
      <div className="p-4 bg-white flex items-center justify-between border-b">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-textMain">Meal Token</h2>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatus showLabel={false} />
          <button className="p-2 text-textSecondary"><Share2 className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 items-center overflow-y-auto min-h-0">
        {/* Success Banner */}
        <div className="w-full bg-success/10 text-success p-4 rounded-2xl flex items-center gap-3 mb-8">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <p className="text-sm font-bold">Payment Successful! Ready for Pickup.</p>
        </div>

        {/* QR Card */}
        <div className={`w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-t-8 transition-all border-green-500 text-center relative overflow-visible`}>
          <h3 className="text-xl font-bold text-textMain mb-1">Scan this QR at the serving counter</h3>
          <p className="text-xs text-textSecondary mb-6">Show this to the server to get your food</p>

          {qrIsVisible && qrString && (
            <div className="w-full flex justify-center items-center mb-6">
              <div className="p-8 bg-white border-4 border-green-500 rounded-3xl shadow-2xl flex items-center justify-center">
                <div className="bg-white p-4 rounded-2xl">
                  <QRCodeSVG 
                    value={qrString}
                    size={300}
                    level="M"
                    includeMargin={true}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                </div>
              </div>
            </div>
          )}

          {!qrIsVisible && (
            <div className="p-6 mb-6">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />
            </div>
          )}

          <div className="space-y-1 mb-6">
            <p className="text-xs text-textSecondary font-bold">ORDER ID</p>
            <p className="text-sm font-mono font-bold text-textMain">#{order.id.slice(-8).toUpperCase()}</p>
          </div>

          <div className="pt-6 border-t border-dashed border-gray-200">
             <div className="flex justify-between items-center px-4">
                <span className="text-xs text-textSecondary font-bold">AMOUNT PAID</span>
                <span className="text-lg font-bold text-primary">₹{order.totalAmount}</span>
             </div>
          </div>
        </div>

        {/* ✨ UX Micro-Interaction: Smart Motivational Quote Engine */}
        {qrIsVisible && <QuoteDisplay order={order} orderCount={orderCount} />}

        {/* Instructions */}
        <div className="mt-8 space-y-4 w-full">
           <div className="flex flex-col gap-3 bg-primary/5 border border-primary/10 p-5 rounded-2xl">
             <div className="flex items-start gap-3">
               <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
               <div className="text-[11px] text-textSecondary leading-relaxed font-medium">
                 This QR code is valid for <strong>one scan only</strong>. Once scanned at the serving counter, it will be deactivated permanently.
               </div>
             </div>
           </div>
        </div>
      </div>

      <div className="p-6">
        <button 
          onClick={onBack}
          className="w-full bg-white text-textMain font-bold py-4 rounded-2xl border-2 border-gray-100 active:scale-95 transition-all shadow-sm"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default QRView;
