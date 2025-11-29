import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore'; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Toast } from '@capacitor/toast';

// Capacitor Plugins
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ShareExtension } from 'capacitor-share-extension';

// Core Logic (REMOVED: import { updateFriendBalance } from '../../utils/friendBalanceUtils';)

// --- IST HELPER FUNCTION (Unchanged) ---
const IST_OFFSET = 19800000;

function formatToIST_YYYY_MM_DD(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function formatDateKey(date) { return formatToIST_YYYY_MM_DD(date); }
// --- END OF IST HELPER ---
  
function AddExpense({ userId, expenseToEdit, onDone }) {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    // REMOVED: [friends, setFriends]
    const [loading, setLoading] = useState(true);
    
    // Default form data (REVERTED to simple headcount)
    const defaultFormData = {
        amount: '', 
        payerName: '', 
        category: '', 
        newCategory: '', 
        date: formatDateKey(new Date()),
        headcount: 1, // <-- RESTORED
        note: '', 
        frequency: 'Non-Recurring',
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [saveStatus, setSaveStatus] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // --- Image Scanning State ---
    const [base64ImageData, setBase64ImageData] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);
    const [fileName, setFileName] = useState("No file selected.");
    const [scanStatusMessage, setScanStatusMessage] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    
    const [activeView, setActiveView] = useState('manual'); 
    const isEditMode = Boolean(expenseToEdit);
    
    // Utility: Resets scan and file state
    const resetScannerState = () => {
        setBase64ImageData(null);
        setImageMimeType(null);
        setFileName("No file selected.");
        setScanStatusMessage(null);
        setPreviewUrl(null); 
        const fileInput = document.getElementById('file-upload');
        if (fileInput) fileInput.value = null; 
    };
    
    // Utility: Processes the file object (for Upload/Paste)
    const processFile = (file) => {
        setScanStatusMessage("Processing image...");
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            const parts = event.target.result.split(',');
            const base64 = parts[1];
            const mime = parts[0].match(/:(.*?);/)[1];
            const dataUrl = event.target.result;

            setBase64ImageData(base64);
            setImageMimeType(mime);
            setPreviewUrl(dataUrl); // Set preview URL
            setScanStatusMessage("Image ready to scan.");
        };
        reader.onerror = () => {
            setScanStatusMessage("Error reading file.");
            resetScannerState();
        };
        reader.readAsDataURL(file);
    };

    // --- 1. Fetch Categories (Unchanged) ---
    useEffect(() => {
        if (!userId) return;
        const catQuery = query(collection(db, `users/${userId}/categories`), orderBy("name"));
        const unsubscribe = onSnapshot(catQuery, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(catList);
            setLoading(false);
        }, (err) => { setLoading(false); });
        return () => unsubscribe();
    }, [userId]);

    // --- 2. Fetch Friends (REMOVED) ---
    // useEffect(() => { /* ... removed logic ... */ }, [userId]);


    // --- 3. ShareExtension (Restored Logic) ---
    useEffect(() => {
        if (isEditMode) return; 
        const checkShare = async () => {
          if (!Capacitor.isNativePlatform()) return;
          try {
            const result = await ShareExtension.checkSendIntentReceived();
            if (result && result.payload && result.payload.length > 0) {
              const item = result.payload[0];
              if (!item.type || !item.type.startsWith('image')) {
                if (Capacitor.getPlatform() === 'android') await ShareExtension.finish();
                return;
              }
      
              const filePath = decodeURIComponent(item.url);
              const fileData = await Filesystem.readFile({ path: filePath });
      
              const mime = decodeURIComponent(item.type);
              const name = item.title || 'shared-image.jpg';
              const base64Data = fileData.data; 
              const dataUrl = `data:${mime};base64,${base64Data}`; // Reconstruct data URL
      
              setPreviewUrl(dataUrl);
              setBase64ImageData(base64Data);
              setImageMimeType(mime);
              setFileName(name);
              setScanStatusMessage('Shared image loaded. Tap Scan to process.');
              setActiveView('scan'); 
      
              if (Capacitor.getPlatform() === 'android') await ShareExtension.finish();
            }
          } catch (e) {
            if (e.message !== 'No processing needed.') console.error('ShareExtension error:', e);
          }
        };
        checkShare();
      }, [isEditMode]);
      
    // --- 4. Form Handlers (Restored Simple Logic) ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'category' && value !== '--OTHER--') {
            setFormData(prev => ({ ...prev, newCategory: '' }));
        }
    };

    // --- File Input Handlers (Restored) ---
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        } else {
            resetScannerState();
        }
    };

    const handlePaste = async () => {
        setScanStatusMessage("Reading clipboard...");
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                setScanStatusMessage("Clipboard API not supported.");
                return;
            }

            const clipboardItems = await navigator.clipboard.read();
            let imageBlob = null;

            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith("image/"));
                if (imageType) {
                    imageBlob = await item.getType(imageType);
                    break;
                }
            }

            if (imageBlob) {
                processFile(new File([imageBlob], "pasted-image.png", { type: imageBlob.type }));
                setScanStatusMessage("Image pasted! Tap Scan to process.");
            } else {
                setScanStatusMessage("No image found on clipboard.");
            }
        } catch (err) {
            console.error('Error pasting from clipboard:', err);
            setScanStatusMessage("Paste failed. Permission denied.");
        }
    };

    // --- 5. CORE SAVE LOGIC (REVERTED TO HEADCOUNT) ---
    const handleSaveExpense = async (e) => {
        e.preventDefault();
        setSaveStatus(null);
        setIsSaving(true);

        const totalAmount = parseFloat(formData.amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            alert("Please enter a valid amount.");
            setIsSaving(false);
            return;
        }

        let finalCategory = formData.category;
        let newCategoryKeywords = [];

        if (finalCategory === '--OTHER--') {
            finalCategory = formData.newCategory.trim().toUpperCase();
            if (!finalCategory) { alert("Please enter a name for the new category."); setIsSaving(false); return; }
            newCategoryKeywords.push(finalCategory);
        }
        
        // --- RESTORE HEADCOUNT/SIMPLE SAVE STRUCTURE ---
        const expenseData = {
            amount: totalAmount,
            payerName: formData.payerName.trim(),
            category: finalCategory,
            timestamp: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')), 
            userId: userId,
            headcount: Number(formData.headcount) || 1, // <-- RESTORED
            note: formData.note.trim(), 
            frequency: formData.frequency,
            // Split fields (yourShare, split, etc.) are removed from save data
        };

        try {
            await addDoc(collection(db, `users/${userId}/expenses`), expenseData);

            // No debt update logic here anymore

            if (finalCategory === formData.newCategory.trim().toUpperCase() && !categories.find(c => c.name === finalCategory)) {
                await addDoc(collection(db, `users/${userId}/categories`), {
                    name: finalCategory,
                    keywords: newCategoryKeywords,
                    createdAt: Timestamp.now(),
                    color: '#6B7280'
                });
            }

            setSaveStatus('success');
            if (onDone) onDone(); 

            setFormData(defaultFormData);
            resetScannerState();
            Toast.show({ text: 'Transaction saved!', duration: 'short' });
            setTimeout(() => setSaveStatus(null), 3000);

        } catch (error) {
            console.error("Error saving expense:", error);
            setSaveStatus('error');
            Toast.show({ text: `Failed to save transaction: ${error.message}`, duration: 'long' });
            setTimeout(() => setSaveStatus(null), 5000);
        } finally{
            setIsSaving(false);
        }
    };

    // --- 6. Scan/Process Handlers (Restored Logic) ---
    const handleScan = async () => {
        if (!base64ImageData || !imageMimeType) {
            setScanStatusMessage("Please upload or paste an image first.");
            return;
        }

        setIsScanning(true);
        setScanStatusMessage("Scanning & Saving...");

        try {
            const functions = getFunctions();
            const scanReceipt = httpsCallable(functions, 'scanReceipt');

            const result = await scanReceipt({ 
                base64Data: base64ImageData, 
            });
            
            const { savedData } = result.data;
            
            setScanStatusMessage(`Saved: ${savedData.payerName} ($${savedData.amount})`);
            Toast.show({ text: `Saved: ${savedData.payerName} ($${savedData.amount})`, duration: 'long' });
            resetScannerState(); 
            
            setTimeout(() => {
                setScanStatusMessage(null);
                if (onDone) onDone();
            }, 2000);

        } catch (err) {
            console.error("Scan error:", err);
            setScanStatusMessage(`Scan failed: ${err.message}`);
            Toast.show({ text: `Scan failed: ${err.message}`, duration: 'long' });
        } finally {
            setIsScanning(false);
        }
    };


    // --- 7. Render Logic ---
    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading categories...</p>
            </div>
        );
    }

    const categoryOptions = categories.map(cat => (
        <option key={cat.id} value={cat.name}>{cat.name}</option>
    ));
    const isScanButtonDisabled = isScanning || !base64ImageData;


    if (isEditMode) return null;

    return (
        <div className="space-y-6">
            
            {/* Batch Upload Button (Unchanged) */}
            <div className="mb-4">
              <Link 
                to="/batch-upload"
                className="w-full flex items-center justify-center p-3 text-sm font-bold text-blue-600 bg-blue-100 rounded-full shadow-sm hover:bg-blue-200 transition"
              >
                <i className="fas fa-images mr-2"></i>
                Have multiple receipts? Go to Batch Upload
              </Link>
            </div>

            {/* --- Toggle Buttons (Unchanged) --- */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-200 rounded-lg">
                <button
                    onClick={() => setActiveView('manual')}
                    className={`py-2 px-4 rounded-md font-semibold transition-all ${
                        activeView === 'manual' ? 'bg-white shadow' : 'text-gray-600'
                    }`}
                >
                    Manual Entry
                </button>
                <button
                    onClick={() => setActiveView('scan')}
                    className={`py-2 px-4 rounded-md font-semibold transition-all ${
                        activeView === 'scan' ? 'bg-white shadow' : 'text-gray-600'
                    }`}
                >
                    Scan Receipt
                </button>
            </div>

            {/* --- View 1: Scan (Restored Content) --- */}
            {activeView === 'scan' && (
                <div className="bg-gray-50 p-6 rounded-xl shadow-inner border border-gray-200">
                    <h3 className="text-xl font-semibold mb-6 text-gray-800">Scan & Auto-Fill</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Share an image to the app, paste from your clipboard, or upload one here. 
                        The AI will scan, save, and categorize it for you.
                    </p>

                    {previewUrl && (
                        <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Image Preview</h3>
                            <img 
                                src={previewUrl} 
                                alt="Shared image preview" 
                                className="max-w-full h-auto rounded-lg border border-gray-200"
                            />
                        </div>
                    )}

                    <div className="flex flex-col space-y-4">
                        <div className="border-2 border-gray-300 border-dashed rounded-lg shadow-sm cursor-pointer bg-white hover:bg-gray-50 transition">
                            <label htmlFor="file-upload" className="w-full flex justify-center px-6 py-8">
                                <div className="text-center">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                    <p className="mt-4 text-sm text-gray-600 font-medium">Click to upload or drag & drop</p>
                                    <p className="text-xs text-gray-500">{fileName}</p>
                                </div>
                            </label>
                            {/* This is the input that needs handleFileSelect */}
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleFileSelect} />
                        </div>
                        <button
                            onClick={handlePaste}
                            className="py-3 px-4 text-sm font-bold text-white bg-gray-500 rounded-lg shadow hover:bg-gray-600 transition"
                        >
                            Paste Image from Clipboard
                        </button>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleScan}
                            className={`w-full py-3 px-4 text-sm font-bold text-white rounded-lg shadow transition ${isScanButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            disabled={isScanButtonDisabled}
                        >
                            {isScanning ? (
                                <><svg className="animate-spin h-5 w-5 text-white inline-block mr-2" viewBox="0 0 24 24"></svg> Scanning...</>
                            ) : 'Scan, Save & Categorize'}
                        </button>
                    </div>
                
                    {scanStatusMessage && (
                        <div className={`mt-4 p-3 text-sm text-center rounded-lg ${scanStatusMessage.includes('Saved') ? 'bg-green-100 text-green-700' : scanStatusMessage.includes('failed') || scanStatusMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                            {scanStatusMessage}
                        </div>
                    )}
                </div>
            )}

            {/* --- View 2: Manual (UPDATED) --- */}
            {activeView === 'manual' && (
                <div className="bg-white p-6 rounded-xl shadow-xl">
                    <h3 className="text-xl font-semibold mb-6 text-gray-800">Manual Transaction Entry</h3>

                    <form onSubmit={handleSaveExpense} className="space-y-4">

                        {/* --- Amount & Headcount Input (RESTORED) --- */}
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (Total)</label>
                                <input
                                    type="number" id="amount" name="amount" step="0.01"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.amount} onChange={handleChange} required
                                />
                            </div>
                            <div className="w-1/3">
                                <label htmlFor="headcount" className="block text-sm font-medium text-gray-700">Split By</label>
                                <input
                                    type="number" id="headcount" name="headcount" min="1" step="1"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.headcount} onChange={handleChange} required
                                />
                            </div>
                        </div>
                        {/* --- END RESTORED INPUTS --- */}


                        {/* --- Existing Payer Name, Frequency, Category, Date, Note inputs go here --- */}
                        <div>
                            <label htmlFor="payerName" className="block text-sm font-medium text-gray-700">Paid To (Merchant/Payer)</label>
                            <input
                                type="text" id="payerName" name="payerName"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.payerName} onChange={handleChange} required
                            />
                        </div>

                        <div>
                            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Type</label>
                            <select
                                id="frequency" name="frequency"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                value={formData.frequency} onChange={handleChange}
                            >
                                <option value="Non-Recurring">Non-Recurring</option>
                                <option value="Recurring">Recurring</option>
                                <option value="Investment">Investment</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                            <select
                                id="category" name="category"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                value={formData.category} onChange={handleChange} required
                            >
                                <option value="" disabled>-- Select Category --</option>
                                {categoryOptions}
                                <option value="--OTHER--">** Add New... **</option>
                            </select>
                        </div>

                        {formData.category === '--OTHER--' && (
                            <div>
                                <label htmlFor="newCategory" className="block text-sm font-medium text-gray-700">New Category Name</label>
                                <input
                                    type="text" id="newCategory" name="newCategory"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.newCategory} onChange={handleChange} required
                                />
                            </div>
                        )}

                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                            <input
                                type="date" id="date" name="date"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.date} onChange={handleChange} required
                            />
                        </div>

                        <div>
                            <label htmlFor="note" className="block text-sm font-medium text-gray-700">Note (Optional)</label>
                            <input
                                type="text" id="note" name="note"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.note} onChange={handleChange}
                                placeholder="e.g., Dinner with team"
                            />
                        </div>
                        {/* --- End Existing Inputs --- */}


                        <button
                            type="submit"
                            className={`w-full py-3 px-4 text-white font-bold rounded-lg shadow transition ${
                                isSaving
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-green-600 hover:bg-green-700'
                            }`}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24"></svg>
                                    Saving...
                                </span>
                            ) : (
                                'Save Transaction'
                            )}
                        </button>

                        {saveStatus === 'success' && (
                            <div className="p-3 text-center bg-green-100 text-green-700 rounded-lg">
                                Transaction saved successfully!
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="p-3 text-center bg-red-100 text-red-700 rounded-lg">
                                Save failed. Please try again.
                            </div>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}

export default AddExpense;