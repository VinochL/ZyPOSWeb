import { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebase';
import { ref, set, get, child, update } from 'firebase/database';

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(1);
  const [productNo, setProductNo] = useState(1);
  const [productName, setProductName] = useState('');
  const [rate, setRate] = useState('');
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [keyboardMode, setKeyboardMode] = useState(null);
  const [keyboardValue, setKeyboardValue] = useState('');

  // Edit popup state
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editDiscount, setEditDiscount] = useState('');

  // Invoice history state
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [viewingDetails, setViewingDetails] = useState([]);
  const [reprintDisabled, setReprintDisabled] = useState(false);

  // Fetch max invoiceNo and history on mount
  useEffect(() => {
    const fetchData = async () => {
      const headerSnap = await get(child(ref(db), 'InvoiceCardHeaderCal'));
      if (headerSnap.exists()) {
        const data = headerSnap.val();
        const history = Object.values(data).map(h => ({
          InvoiceNo: h.InvoiceNo,
          InvoiceSysDate: h.InvoiceSysDate,
          TotalPrice: h.TotalPrice,
          PaidAmount: h.PaidAmount,
          ProductCount: h.ProductCount
        })).sort((a, b) => b.InvoiceNo - a.InvoiceNo);
        setInvoiceHistory(history);
        const keys = Object.keys(data).map(Number);
        setInvoiceNo(Math.max(...keys) + 1);
      } else {
        setInvoiceNo(1);
      }
    };
    fetchData();
  }, []);

  // Custom keypad input
  const handleKeyboardInput = (val) => {
    if (val === 'C') setKeyboardValue('');
    else if (val === '.' && !keyboardValue.includes('.')) setKeyboardValue(prev => prev + val);
    else if (val !== '.') setKeyboardValue(prev => prev + val);
  };

  const handleKeyboardOK = () => {
    const value = parseFloat(keyboardValue);
    if (keyboardMode === 'qty') {
      if (isNaN(value) || value <= 0) alert('Quantity must be > 0');
      else setQty(value);
    }
    if (keyboardMode === 'discount') setDiscount(isNaN(value) ? 0 : value);
    setKeyboardValue('');
    setKeyboardMode(null);
  };

  const handleClearLine = () => {
    setProductName(''); setRate(''); setQty(1); setDiscount(0);
  };

  const handleAdd = () => {
    if (!productName || !rate || qty <= 0) { alert('Fill all fields'); return; }
    const amount = qty * parseFloat(rate) - parseFloat(discount || 0);
    setItems([...items, { id: productNo, name: productName, rate: parseFloat(rate), qty, discount: parseFloat(discount), amount }]);
    setProductNo(prev => prev + 1);
    handleClearLine();
  };

  const handleDeleteItem = (id) => setItems(items.filter(item => item.id !== id));

  // Open edit popup
  const openEdit = (item) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setEditRate(item.rate.toString());
    setEditQty(item.qty.toString());
    setEditDiscount(item.discount.toString());
  };

  const handleEditCancel = () => setEditingItemId(null);

  const handleEditSave = () => {
    const newRate = parseFloat(editRate);
    const newQty = parseFloat(editQty);
    const newDiscount = parseFloat(editDiscount);
    if (isNaN(newRate) || isNaN(newQty) || newQty <= 0) { alert('Invalid values'); return; }
    setItems(items.map(item => item.id === editingItemId ? { ...item,
      rate: newRate,
      qty: newQty,
      discount: isNaN(newDiscount) ? 0 : newDiscount,
      amount: newQty * newRate - (isNaN(newDiscount) ? 0 : newDiscount)
    } : item));
    setEditingItemId(null);
  };

  // Print and save invoice
  const handlePrintAndSave = async () => {
    const paid = parseFloat(paidAmount);
    if (isNaN(paid) || paid <= 0) { alert('Paid amount must be > 0'); return; }
    const totalPrice = items.reduce((sum, i) => sum + i.amount, 0);
    const balance = paid - totalPrice;
    await set(ref(db, `InvoiceCardHeaderCal/${invoiceNo}`), {
      ID: invoiceNo,
      InvoiceNo: invoiceNo,
      InvoiceSysDate: new Date().toISOString(),
      ProductCount: items.length,
      DiscountPrice: items.reduce((sum, i) => sum + i.discount, 0),
      TotalPrice: totalPrice,
      PaidAmount: paid,
      Balance: balance,
      IsHold: false,
      IsPrinted: false
    });
    for (const item of items) {
      await set(child(ref(db, `InvoiceCardDetailsCal/${invoiceNo}`), `item${item.id}`), {
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
    alert(`Invoice #${invoiceNo} saved.`);
    // Refresh history
    const headerSnap = await get(child(ref(db), 'InvoiceCardHeaderCal'));
    if (headerSnap.exists()) {
      const data = headerSnap.val();
      const history = Object.values(data).map(h => ({
        InvoiceNo: h.InvoiceNo,
        InvoiceSysDate: h.InvoiceSysDate,
        TotalPrice: h.TotalPrice,
        PaidAmount: h.PaidAmount,
        ProductCount: h.ProductCount
      })).sort((a, b) => b.InvoiceNo - a.InvoiceNo);
      setInvoiceHistory(history);
    }
    setDrawerOpen(false);
    setItems([]);
    setPaidAmount('');
    setInvoiceNo(prev => prev + 1);
    setProductNo(1);
  };

  // Re-print invoice
  const handleReprint = async () => {
    if (!viewingInvoice) return;
    setReprintDisabled(true);
    await update(ref(db, `InvoiceCardHeaderCal/${viewingInvoice.InvoiceNo}`), { IsPrinted: true });
  };

  // View invoice details
  const openInvoiceView = async (inv) => {
    setViewingInvoice(inv);
    setReprintDisabled(false);
    const detailsSnap = await get(child(ref(db), `InvoiceCardDetailsCal/${inv.InvoiceNo}`));
    setViewingDetails(detailsSnap.exists() ? Object.values(detailsSnap.val()) : []);
  };
  const closeInvoiceView = () => setViewingInvoice(null);

  const totalPrice = items.reduce((t, i) => t + i.amount, 0);
  const paid = parseFloat(paidAmount) || 0;
  const balance = paid - totalPrice;

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <button className="menu-button" onClick={() => setDrawerOpen(!drawerOpen)}>☰</button>
        <h1 className="title">POS System</h1>
      </div>

      {/* Side Drawer */}
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>        
        <div className="drawer-header"><h3>Invoice #{invoiceNo}</h3></div>
        <table className="drawer-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Rate</th><th>Qty</th><th>Dis</th><th>Amount</th><th>Edit</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td>{item.rate}</td>
                <td>{item.qty}</td>
                <td>{item.discount}</td>
                <td>Rs.{item.amount.toFixed(2)}</td>
                <td><button onClick={() => openEdit(item)}>✏️</button></td>
                <td><button onClick={() => handleDeleteItem(item.id)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <p><strong>Total: Rs.{totalPrice.toFixed(2)}</strong></p>
        <input type="number" placeholder="Paid Amount" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
        <p><strong>Balance: Rs.{balance.toFixed(2)}</strong></p>
        <button onClick={handlePrintAndSave} disabled={paid <= 0}>Print</button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <h2>Invoice No: #{invoiceNo}</h2>
        <p>Product No: {productNo}</p>
        <input type="text" placeholder="Product Name" value={productName} onChange={e => setProductName(e.target.value)} />
        <input type="number" placeholder="Rate" value={rate} onChange={e => setRate(e.target.value)} />
        <div className="pos-buttons">
          <button onClick={() => setKeyboardMode('qty')}>QTY ({qty})</button>
          <button onClick={() => setKeyboardMode('discount')}>Dis ({discount})</button>
          <button onClick={handleClearLine}>C</button>
        </div>
        <div className="pos-actions">
          <button onClick={() => setDrawerOpen(true)}>Check Out</button>
          <button onClick={handleAdd}>Add</button>
        </div>

        {/* Invoice Transactions */}
        <h3>Invoice Transactions</h3>
        <div className="transactions-container">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>No</th><th>Date</th><th>Total</th><th>Paid</th><th>Items</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoiceHistory.map(inv => (
                <tr key={inv.InvoiceNo}>
                  <td>{inv.InvoiceNo}</td>
                  <td>{new Date(inv.InvoiceSysDate).toLocaleString()}</td>
                  <td>{inv.TotalPrice.toFixed(2)}</td>
                  <td>{inv.PaidAmount.toFixed(2)}</td>
                  <td>{inv.ProductCount}</td>
                  <td><button onClick={() => openInvoiceView(inv)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Popup */}
      {editingItemId !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '300px' }}>
            <h3>Edit Item #{editingItemId} - {editingItemName}</h3>
            <div style={{ marginBottom: '10px' }}>
              <label>Rate:<input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} /></label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Qty:<input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} /></label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Dis:<input type="number" value={editDiscount} onChange={e => setEditDiscount(e.target.value)} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={handleEditCancel}>Cancel</button>
              <button onClick={handleEditSave}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Popup */}
      {viewingInvoice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Invoice #{viewingInvoice.InvoiceNo}</h3>
            <p>Date: {new Date(viewingInvoice.InvoiceSysDate).toLocaleString()}</p>
            <table className="drawer-table">
              <thead><tr><th>ID</th><th>Name</th><th>Rate</th><th>Qty</th><th>Dis</th><th>Amount</th></tr></thead>
              <tbody>
                {viewingDetails.map((d, i) => (
                  <tr key={i}><td>{d.ProductID}</td><td>{d.ProductName}</td><td>{d.ProductRetailPrice}</td><td>{d.ProductQty}</td><td>{d.ProductDiscountPrice}</td><td>Rs.{d.ProductTotalPrice.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={closeInvoiceView}>Close</button>
              <button onClick={handleReprint} disabled={reprintDisabled}>RePrint</button>
            </div>
          </div>
        </div>
      )}

      {/* Number Pad Popup */}
      {keyboardMode && (
        <div className="keyboard-popup">
          <div className="keyboard-display">{keyboardValue || '0'}</div>
          <div className="keyboard-grid">
            {['1','2','3','4','5','6','7','8','9','.','0'].map(val => (
              <button key={val} onClick={() => handleKeyboardInput(val)}>{val}</button>
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
