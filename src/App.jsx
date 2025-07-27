import { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebase';
import { ref, set, get, child } from 'firebase/database';

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(1);
  const [productNo, setProductNo] = useState(1);
  const [productName, setProductName] = useState('');
  const [rate, setRate] = useState('');
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [keyboardMode, setKeyboardMode] = useState(null);
  const [keyboardValue, setKeyboardValue] = useState('');

  // Fetch max invoiceNo on mount
  useEffect(() => {
    const fetchInvoiceNo = async () => {
      const snapshot = await get(child(ref(db), 'InvoiceCardHeaderCal'));
      if (!snapshot.exists()) {
        setInvoiceNo(1);
      } else {
        const allKeys = Object.keys(snapshot.val() || {}).map(Number);
        const maxKey = Math.max(...allKeys);
        setInvoiceNo(maxKey + 1);
      }
    };
    fetchInvoiceNo();
  }, []);

  const handleKeyboardInput = (val) => {
    if (val === 'C') {
      setKeyboardValue('');
    } else {
      setKeyboardValue((prev) => prev + val);
    }
  };

  const handleKeyboardOK = () => {
    if (keyboardMode === 'qty') setQty(Number(keyboardValue));
    if (keyboardMode === 'discount') setDiscount(Number(keyboardValue));
    setKeyboardValue('');
    setKeyboardMode(null);
  };

  const handleClearLine = () => {
    setProductName('');
    setRate('');
    setQty(1);
    setDiscount(0);
  };

  const handleAdd = () => {
    if (!productName || !rate || qty <= 0) {
      alert("Fill all fields");
      return;
    }

    const amount = qty * parseFloat(rate) - parseFloat(discount || 0);
    const item = {
      id: productNo,
      name: productName,
      rate: parseFloat(rate),
      qty,
      discount: parseFloat(discount),
      amount
    };

    setItems([...items, item]);
    setProductNo(productNo + 1);
    handleClearLine();
  };

  const handleDeleteItem = (id) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
  };

  const handlePrintAndSave = async () => {
    const totalPrice = items.reduce((sum, item) => sum + item.amount, 0);
    const balance = paidAmount - totalPrice;

    const headerRef = ref(db, `InvoiceCardHeaderCal/${invoiceNo}`);
    await set(headerRef, {
      ID: invoiceNo,
      InvoiceNo: invoiceNo,
      InvoiceSysDate: new Date().toISOString(),
      ProductCount: items.length,
      DiscountPrice: items.reduce((sum, item) => sum + item.discount, 0),
      TotalPrice: totalPrice,
      PaidAmount: paidAmount,
      Balance: balance,
      IsHold: false,
      IsPrinted: false
    });

    const detailsRef = ref(db, `InvoiceCardDetailsCal/${invoiceNo}`);
    for (const item of items) {
      await set(child(detailsRef, `item${item.id}`), {
        ID: item.id,
        InvoiceNo: invoiceNo,
        ProductID: item.id,
        ProductName: item.name,
        ProductQty: item.qty,
        ProductRetailPrice: item.rate,
        ProductDiscountPrice: item.discount,
        ProductTotalPrice: item.amount
      });
    }

    alert(`Invoice #${invoiceNo} saved to Firebase.`);
    setDrawerOpen(false);
    setItems([]);
    setPaidAmount(0);
    setInvoiceNo(invoiceNo + 1);
    setProductNo(1);
  };

  const totalPrice = items.reduce((t, i) => t + i.amount, 0);
  const balance = paidAmount - totalPrice;

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <button className="menu-button" onClick={() => setDrawerOpen(!drawerOpen)}>☰</button>
        <h1 className="title">POS System</h1>
      </div>

      {/* Drawer (Invoice Summary) */}
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Invoice #{invoiceNo}</h3>
          <button className="close-button" onClick={() => setDrawerOpen(false)}>❌</button>
        </div>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              {item.name} - Qty: {item.qty}, Rate: {item.rate}, Dis: {item.discount}, Rs.{item.amount.toFixed(2)}
              <button onClick={() => handleDeleteItem(item.id)} style={{ marginLeft: '10px' }}>🗑</button>
            </li>
          ))}
        </ul>
        <hr />
        <p><strong>Total: Rs.{totalPrice.toFixed(2)}</strong></p>
        <input
          type="number"
          placeholder="Paid Amount"
          value={paidAmount}
          onChange={(e) => setPaidAmount(Number(e.target.value))}
        />
        <p><strong>Balance: Rs.{balance.toFixed(2)}</strong></p>
        <button onClick={handlePrintAndSave}>Print</button>
      </div>

      {/* Main POS UI */}
      <div className="main-content">
        <h2>Invoice No: #{invoiceNo}</h2>
        <p>Product No: {productNo}</p>
        <input type="text" placeholder="Product Name" value={productName} onChange={(e) => setProductName(e.target.value)} />
        <input type="number" placeholder="Rate" value={rate} onChange={(e) => setRate(e.target.value)} />
        <div className="pos-buttons">
          <button onClick={() => setKeyboardMode('qty')}>QTY ({qty})</button>
          <button onClick={() => setKeyboardMode('discount')}>Dis ({discount})</button>
          <button onClick={handleClearLine}>C</button>
        </div>
        <div className="pos-actions">
          <button onClick={() => setDrawerOpen(true)}>Check Out</button>
          <button onClick={handleAdd}>Add</button>
        </div>
      </div>

      {/* Number Pad Popup */}
      {keyboardMode && (
        <div className="keyboard-popup">
          <div className="keyboard-display">{keyboardValue || '0'}</div>
          <div className="keyboard-grid">
            {[1,2,3,4,5,6,7,8,9,0].map((n) => (
              <button key={n} onClick={() => handleKeyboardInput(n.toString())}>{n}</button>
            ))}
            <button onClick={() => handleKeyboardInput('C')}>C</button>
            <button onClick={handleKeyboardOK}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
