// src/components/Expense/AddExpense.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore'; 

// Capacitor Plugins
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ShareExtension } from 'capacitor-share-extension';

// !!! IMPORTANT: ADD YOUR GEMINI API KEY HERE !!!
const GEMINI_API_KEY = "AIzaSyAZJOfCX_WZmXb1bD0lU0-8pn5LPCKNxGA";

  
function AddExpense({ userId, expenseToEdit, onDone }) {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        amount: '', 
        payerName: '', 
        category: '', 
        newCategory: '', 
        date: formatDateKey(new Date()),
        headcount: 1, // <-- 1. ADDED headcount to state
    });
    const [saveStatus, setSaveStatus] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // --- Image Scanning State ---
    const [base64ImageData, setBase64ImageData] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);
    const [fileName, setFileName] = useState("No file selected.");
    const [scanStatusMessage, setScanStatusMessage] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    const isEditMode = Boolean(expenseToEdit);

    // Utility: Format date to YYYY-MM-DD
    function formatDateKey(date) {
        return new Date(date).toISOString().slice(0, 10);
    }

    // Utility: Resets scan and file state
    const resetScannerState = () => {
        setBase64ImageData(null);
        setImageMimeType(null);
        setFileName("No file selected.");
        setScanStatusMessage(null);
        setPreviewUrl(null);
        const fileInput = document.getElementById('file-upload');
        if (fileInput) {
            fileInput.value = null; 
        }
    };

    // --- 1. Fetch Categories in Real-Time ---
    useEffect(() => {
        if (!userId) return;
        const catQuery = query(collection(db, `users/${userId}/categories`), orderBy("name"));
        const unsubscribe = onSnapshot(catQuery, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(catList);
            setLoading(false);
        }, (err) => {
            console.error("Category Fetch Error:", err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userId]);

    // --- 2. useEffect for ShareExtension (This is the correct one) ---
    useEffect(() => {
        if (isEditMode) return; 
        
        let cancelled = false;
      
        const checkShare = async () => {
          if (!Capacitor.isNativePlatform()) return;
      
          try {
            const result = await ShareExtension.checkSendIntentReceived();
      
            if (result && result.payload && result.payload.length > 0) {
              if (cancelled) return;
      
              const item = result.payload[0];
              
              if (!item.type || !item.type.startsWith('image')) {
                if (Capacitor.getPlatform() === 'android') {
                    await ShareExtension.finish();
                }
                return;
              }
      
              const filePath = decodeURIComponent(item.url);
              
              const fileData = await Filesystem.readFile({
                path: filePath
              });
      
              if (cancelled) return;
      
              const mime = decodeURIComponent(item.type);
              const name = item.title || 'shared-image.jpg';
              const base64Data = fileData.data; 
              const dataUrl = `data:${mime};base64,${base64Data}`;
      
              setPreviewUrl(dataUrl);
              setBase64ImageData(base64Data);
              setImageMimeType(mime);
              setFileName(name);
              setScanStatusMessage('Shared image loaded. Tap Scan to process.');
      
              if (Capacitor.getPlatform() === 'android') {
                await ShareExtension.finish();
              }
            }
          } catch (e) {
            if (e.message !== 'No processing needed.') {
                console.error('ShareExtension error:', e);
            }
          }
        };
      
        checkShare();
      
        return () => {
          cancelled = true;
        };
      }, [isEditMode]);

    // --- 4. Form Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'category' && value !== '--OTHER--') {
            setFormData(prev => ({ ...prev, newCategory: '' }));
        }
    };

    // --- 5. Save Logic ---
    const handleSaveExpense = async (e) => {
        e.preventDefault();
        setSaveStatus(null);
        setIsSaving(true)

        let finalCategory = formData.category;
        let newCategoryKeywords = [];

        if (finalCategory === '--OTHER--') {
            finalCategory = formData.newCategory.trim().toUpperCase();
            if (!finalCategory) { alert("Please enter a name for the new category."); return; }
            newCategoryKeywords.push(finalCategory);
        }

        const expenseData = {
            amount: parseFloat(formData.amount),
            payerName: formData.payerName.trim(),
            category: finalCategory,
            timestamp: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')), 
            userId: userId,
            headcount: Number(formData.headcount) || 1, // <-- 2. SAVE HEADCOUNT from form
        };

        try {
            await addDoc(collection(db, `users/${userId}/expenses`), expenseData);

            if (finalCategory === formData.newCategory.trim().toUpperCase() && !categories.find(c => c.name === finalCategory)) {
                await addDoc(collection(db, `users/${userId}/categories`), {
                    name: finalCategory,
                    keywords: newCategoryKeywords,
                    createdAt: Timestamp.now(),
                    color: '#6B7280' // Add default color
                });
            }

            setSaveStatus('success');
            
            if (onDone) {
                onDone(); 
            }

            // Reset the form
            setFormData({ 
                amount: '', 
                payerName: '', 
                category: '', 
                newCategory: '', 
                date: formatDateKey(new Date()),
                headcount: 1 // <-- 3. RESET HEADCOUNT
            });
            resetScannerState();
            setTimeout(() => setSaveStatus(null), 3000);

        } catch (error) {
            console.error("Error saving expense:", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 5000);
            alert("Failed to save transaction.");
        } finally{
            setIsSaving(false)
        }
    };

    // --- 6. Gemini API Call (FIXED) ---
    const callGeminiAPI = async (imageData, imageMimeType) => {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE"){
            throw new Error("Gemini API Key is not configured.");
        }
        
        const keywordMap = {};
        categories.forEach(cat => cat.keywords.forEach(kw => keywordMap[kw.toUpperCase()] = cat.name));
        const mappingString = JSON.stringify(keywordMap);
        
        const systemPrompt = "Analyze the payment receipt screenshot. Extract the data as JSON.";
        const userPrompt = `Extract the following data: 1. amount (number). 2. merchantName (string, the store, business, or person *receiving* the payment. Do NOT extract the sender's name). 3. transaction date (YYYY-MM-DD). Use the mapping ${mappingString} to find the appropriate category. If no match, use 'UNCATEGORIZED'. The output MUST be valid JSON.`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const payload = {
            contents: [{ 
                role: "user", 
                parts: [
                    { text: userPrompt }, 
                    { inlineData: { mimeType: imageMimeType, data: imageData } }
                ] 
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            
            generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: { 
                    type: "OBJECT", 
                    properties: { 
                        "amount": { "type": "NUMBER" }, 
                        "merchantName": { "type": "STRING" },
                        "category": { "type": "STRING" }, 
                        "date": { "type": "STRING", "description": "YYYY-MM-DD" } 
                    }, 
                    required: ["amount", "merchantName", "category", "date"] 
                }
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Gemini API Full Error:", errorBody);
            throw new Error(`API failed: ${errorBody.error?.message || response.statusText}`);
        }
        
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) throw new Error("No text response from API.");
        return JSON.parse(jsonText);
    };

    // --- 7. Scan/Process Handlers (FIXED) ---
    const handleScan = async () => {
        if (!base64ImageData || !imageMimeType) {
            setScanStatusMessage("Please upload or paste an image first.");
            return;
        }

        setIsScanning(true);
        setScanStatusMessage("Scanning receipt with AI...");

        try {
            const extractedData = await callGeminiAPI(base64ImageData, imageMimeType);

            setFormData(prev => ({
                ...prev,
                amount: extractedData.amount || '',
                payerName: extractedData.merchantName || '', 
                date: extractedData.date || formatDateKey(new Date()),
                headcount: 1, // <-- 4. RESET HEADCOUNT on new scan
            }));

            const extractedCategory = (extractedData.category || 'UNCATEGORIZED').toUpperCase();
            const categoryMatch = categories.find(c => c.name === extractedCategory);

            if (categoryMatch) {
                setFormData(prev => ({ ...prev, category: categoryMatch.name, newCategory: '' }));
            } else {
                setFormData(prev => ({ ...prev, category: '--OTHER--', newCategory: extractedCategory }));
            }

            setScanStatusMessage("Scan complete! Review details and save.");
        } catch (err) {
            console.error("Scan error:", err);
            setScanStatusMessage(`Scan failed: ${err.message}`);
        } finally {
            setIsScanning(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        } else {
            resetScannerState();
        }
    };

    const processFile = (file) => {
        setScanStatusMessage("Processing image...");
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            const parts = event.target.result.split(',');
            const base64 = parts[1];
            const mime = parts[0].match(/:(.*?);/)[1];

            setBase64ImageData(base64);
            setImageMimeType(mime);
            setScanStatusMessage("Image ready to scan.");
        };
        reader.onerror = () => {
            setScanStatusMessage("Error reading file.");
            resetScannerState();
        };
        reader.readAsDataURL(file);
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

    // --- 8. Render Logic ---
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

    // This component should not render if it's in edit mode
    if (isEditMode) {
        // This 'onDone' prop comes from FullList -> ExpenseTracker -> AddExpense
        // It's a bit complex, but it's how we're handling the modal.
        // A better way would be a dedicated EditForm, but this matches the user's file.
        // Wait, the user's *previous* file setup uses a *separate* EditExpenseForm.jsx.
        // This component (AddExpense.jsx) *should not* render in edit mode.
        // The check 'if (isEditMode)' is correct based on our previous setup.
        return null;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Batch Upload Button */}
            <div className="md:col-span-2 mb-4">
              <button 
                type="button"
                onClick={() => navigate('/batch-upload')}
                className="w-full flex items-center justify-center p-3 text-sm font-bold text-primary bg-primary-light rounded-full shadow-sm hover:bg-blue-200 transition"
              >
                <i className="fas fa-images mr-2"></i>
                Have multiple receipts? Go to Batch Upload
              </button>
            </div>

            {previewUrl && (
                <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 md:col-span-2">
                    <h3 className="text-lg font-semibold text-text-dark mb-3">Image Preview</h3>
                    <img 
                        src={previewUrl} 
                        alt="Shared image preview" 
                        className="max-w-full h-auto rounded-lg border border-gray-200"
                    />
                </div>
            )}

            {/* Column 1: Scanner (UI for File Handling) */}
            <div className="bg-gray-50 p-6 rounded-xl shadow-inner border border-gray-200">
                {/* ... (Your scanner JSX is unchanged) ... */}
                <h3 className="text-xl font-semibold mb-6 text-gray-800">Scan & Auto-Fill</h3>
                <div className="flex flex-col space-y-4">
                    <div className="border-2 border-gray-300 border-dashed rounded-lg shadow-sm cursor-pointer bg-white hover:bg-gray-50 transition">
                        <label htmlFor="file-upload" className="w-full flex justify-center px-6 py-8">
                            <div className="text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                <p className="mt-4 text-sm text-gray-600 font-medium">Click to upload or drag & drop</p>
                                <p className="text-xs text-gray-500">{fileName}</p>
                            </div>
                        </label>
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
                            <>
                                <svg className="animate-spin h-5 w-5 text-white inline-block mr-2" viewBox="0 0 24 24"></svg>
                                Scanning...
                            </>
                        ) : 'Scan Receipt with AI'}
                    </button>
                </div>
                {scanStatusMessage && (
                    <div className={`mt-4 p-3 text-sm text-center rounded-lg ${scanStatusMessage.includes('Scan complete') ? 'bg-green-100 text-green-700' : scanStatusMessage.includes('failed') || scanStatusMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                        {scanStatusMessage}
                    </div>
                )}
                {base64ImageData && !previewUrl && (
                    <div className="mt-4 p-2 bg-white rounded-lg shadow-inner">
                        <img src={`data:${imageMimeType};base64,${base64ImageData}`} alt="Receipt Preview" className="w-full max-h-48 object-contain rounded" />
                    </div>
                )}
            </div>

            {/* Column 2: Manual Entry Form */}
            <div className="bg-white p-6 rounded-xl shadow-xl">
                <h3 className="text-xl font-semibold mb-6 text-gray-800">Manual Transaction Entry</h3>

                <form onSubmit={handleSaveExpense} className="space-y-4">

                    {/* --- 5. UPDATED Amount & Headcount fields --- */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (Total)</label>
                            <input
                                type="number"
                                id="amount"
                                name="amount"
                                step="0.01"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="w-1/3">
                            <label htmlFor="headcount" className="block text-sm font-medium text-gray-700">Split By</label>
                            <input
                                type="number"
                                id="headcount"
                                name="headcount"
                                min="1"
                                step="1"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.headcount}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                    {/* --- END OF UPDATE --- */}


                    <div>
                        <label htmlFor="payerName" className="block text-sm font-medium text-gray-700">Paid To (Merchant/Payer)</label>
                        <input
                            type="text"
                            id="payerName"
                            name="payerName"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={formData.payerName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                        <select
                            id="category"
                            name="category"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            value={formData.category}
                            onChange={handleChange}
                            required
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
                                type="text"
                                id="newCategory"
                                name="newCategory"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.newCategory}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                        <input
                            type="date"
                            id="date"
                            name="date"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={formData.date}
                            onChange={handleChange}
                            required
                        />
                    </div>

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
        </div>
    );
}

export default AddExpense;