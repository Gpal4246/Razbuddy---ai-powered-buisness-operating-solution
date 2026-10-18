import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { api } from '../../api/client.ts';
import { CurrencyFormat } from './CurrencyFormat.tsx';
import { X, CheckCircle2, ShieldCheck, QrCode, CreditCard, Building2, Smartphone, ArrowRight, Loader2 } from 'lucide-react';

export const RazorpayCheckoutModal: React.FC = () => {
  const { razorpayCheckoutData, closeRazorpayCheckout, showToast, triggerRefresh, onPaymentCompleted } = useApp();
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiVpa, setUpiVpa] = useState('ashish@okhdfcbank');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successPaymentId, setSuccessPaymentId] = useState('');

  if (!razorpayCheckoutData.isOpen) return null;

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      // 1. Create order on server
      const orderRes = await api.createRazorpayOrder({
        amount: razorpayCheckoutData.amount,
        invoiceId: razorpayCheckoutData.invoiceId,
        customerId: razorpayCheckoutData.customerId || 'cust-101',
      });

      // 2. Simulate gateway authorization with authentic latency
      await new Promise(r => setTimeout(r, 1000));
      const fakePaymentId = `pay_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;

      // 3. Verify payment with server
      const verifyRes = await api.verifyRazorpayPayment({
        razorpayOrderId: orderRes.orderId,
        razorpayPaymentId: fakePaymentId,
        invoiceId: razorpayCheckoutData.invoiceId,
        customerId: razorpayCheckoutData.customerId || 'cust-101',
        amount: razorpayCheckoutData.amount,
        paymentMethod: paymentMethod === 'upi' ? 'upi' : (paymentMethod === 'card' ? 'razorpay' : 'bank_transfer'),
      });

      setIsProcessing(false);
      setIsSuccess(true);
      setSuccessPaymentId(verifyRes.payment.referenceNumber);
      showToast('Payment verified successfully via Razorpay Gateway', 'success');
      triggerRefresh();
      if (onPaymentCompleted) {
        onPaymentCompleted(verifyRes.payment.id);
      }
    } catch (err: any) {
      setIsProcessing(false);
      showToast(err.message || 'Payment simulation failed', 'error');
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setIsProcessing(false);
    closeRazorpayCheckout();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-[#E5E7E0] overflow-hidden">
        {/* Header with Razorpay Brand Styling */}
        <div className="bg-[#192A56] text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-sm">
                R
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wider uppercase text-blue-200">Razorpay Gateway</div>
                <div className="text-sm font-medium text-white truncate max-w-[240px]">
                  {razorpayCheckoutData.customerName || 'RazBuddy Merchant'}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-baseline justify-between">
            <span className="text-xs text-white/70">Amount Payable:</span>
            <span className="text-2xl font-bold font-mono">
              <CurrencyFormat amount={razorpayCheckoutData.amount} showDecimals={true} currency="₹" />
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-300">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 256-bit SSL Sandbox
            </span>
            <span className="bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
              TEST MODE ACTIVE
            </span>
          </div>
        </div>

        {/* Content Body */}
        {isSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#252923]">Payment Successful!</h3>
              <p className="text-xs text-[#73766F] mt-1">
                Your payment of <CurrencyFormat amount={razorpayCheckoutData.amount} className="font-semibold" /> was authorized and credited to the invoice balance.
              </p>
            </div>

            <div className="bg-[#F7F7F4] p-3 rounded text-left text-xs space-y-1.5 border border-[#E5E7E0] font-mono">
              <div className="flex justify-between">
                <span className="text-[#73766F]">Gateway Reference:</span>
                <span className="font-semibold text-[#252923]">{successPaymentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#73766F]">Method:</span>
                <span className="capitalize">{paymentMethod}</span>
              </div>
              {razorpayCheckoutData.invoiceId && (
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Settled Invoice:</span>
                  <span>{razorpayCheckoutData.invoiceId}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-[#6D876D] hover:bg-[#5b735b] text-white rounded text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`flex flex-col items-center justify-center p-2.5 rounded border text-xs font-medium transition-colors ${
                  paymentMethod === 'upi'
                    ? 'border-[#6D876D] bg-[#6D876D]/5 text-[#252923]'
                    : 'border-[#E5E7E0] hover:bg-stone-50 text-[#73766F]'
                }`}
              >
                <Smartphone className="w-4 h-4 mb-1 text-[#6D876D]" />
                UPI & QR
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center p-2.5 rounded border text-xs font-medium transition-colors ${
                  paymentMethod === 'card'
                    ? 'border-[#6D876D] bg-[#6D876D]/5 text-[#252923]'
                    : 'border-[#E5E7E0] hover:bg-stone-50 text-[#73766F]'
                }`}
              >
                <CreditCard className="w-4 h-4 mb-1 text-[#6D876D]" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('netbanking')}
                className={`flex flex-col items-center justify-center p-2.5 rounded border text-xs font-medium transition-colors ${
                  paymentMethod === 'netbanking'
                    ? 'border-[#6D876D] bg-[#6D876D]/5 text-[#252923]'
                    : 'border-[#E5E7E0] hover:bg-stone-50 text-[#73766F]'
                }`}
              >
                <Building2 className="w-4 h-4 mb-1 text-[#6D876D]" />
                Netbanking
              </button>
            </div>

            {/* Selected Method Details */}
            {paymentMethod === 'upi' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded border border-[#E5E7E0]">
                  <div className="w-16 h-16 bg-white border border-[#E5E7E0] rounded p-1 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-[#252923]" />
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold text-[#252923]">Scan Dynamic UPI QR</div>
                    <div className="text-[#73766F] mt-0.5">Google Pay, PhonePe, Paytm, CRED or BHIM</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#73766F] mb-1">Or enter UPI ID / VPA</label>
                  <input
                    type="text"
                    value={upiVpa}
                    onChange={e => setUpiVpa(e.target.value)}
                    placeholder="username@bank"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7E0] rounded focus:outline-hidden focus:border-[#6D876D]"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block text-xs font-medium text-[#73766F] mb-1">Card Number (Sandbox Test)</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7E0] rounded focus:outline-hidden focus:border-[#6D876D] font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[#73766F] mb-1">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      defaultValue="12/28"
                      className="w-full px-3 py-2 border border-[#E5E7E0] rounded focus:outline-hidden focus:border-[#6D876D] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#73766F] mb-1">CVV</label>
                    <input
                      type="password"
                      defaultValue="123"
                      maxLength={4}
                      className="w-full px-3 py-2 border border-[#E5E7E0] rounded focus:outline-hidden focus:border-[#6D876D] font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <div className="space-y-3 pt-2 text-xs">
                <label className="block text-xs font-medium text-[#73766F]">Select Bank</label>
                <div className="grid grid-cols-2 gap-2">
                  {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Bank'].map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-2 text-left rounded border text-xs font-medium transition-colors ${
                        selectedBank === bank
                          ? 'border-[#6D876D] bg-[#6D876D]/10 text-[#252923]'
                          : 'border-[#E5E7E0] hover:bg-stone-50 text-[#73766F]'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Pay button */}
            <button
              type="button"
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full mt-4 py-2.5 px-4 bg-[#6D876D] hover:bg-[#5b735b] disabled:opacity-50 text-white rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authorizing via Gateway...
                </>
              ) : (
                <>
                  Pay <CurrencyFormat amount={razorpayCheckoutData.amount} currency="₹" /> <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
