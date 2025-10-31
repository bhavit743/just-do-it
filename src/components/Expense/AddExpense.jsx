// src/components/Expense/AddExpense.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

// 💡 NEW IMPORTS: Capacitor Plugins
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core'; // To check platform
import { AppGroupReader } from '../../plugins/appGroupReader';


// !!! IMPORTANT: ADD YOUR GEMINI API KEY HERE !!!
const GEMINI_API_KEY = "AIzaSyAZJOfCX_WZmXb1bD0lU0-8pn5LPCKNxGA";

const getAppGroupReader = () => {
    const cap = (window).Capacitor || Capacitor;
    return cap?.Plugins?.AppGroupReader || (cap?.Plugins && cap.Plugins['AppGroupReader']);
  };

  const inferMimeFromName = (name = '') => {
    const n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
  
    (async () => {
      try {
        const { files } = await AppGroupReader.list();
        if (!files || !files.length) return;
  
        const name = files[0];
        const { data } = await AppGroupReader.read({ name }); // base64
        if (cancelled) return;
  
        const mime = name.toLowerCase().endsWith('.png') ? 'image/png'
                  : name.toLowerCase().endsWith('.webp') ? 'image/webp'
                  : 'image/jpeg';
  
        // Hook into your existing state + scan flow:
        setBase64ImageData(data);
        setImageMimeType(mime);
        setFileName(name);
        setScanStatusMessage('Shared image loaded. Tap Scan to process.');
  
        // Optionally delete it so it won't re-import next time:
        // await AppGroupReader.remove({ name });
      } catch (e) {
        console.error('AppGroupReader error:', e);
      }
    })();
  
    return () => { cancelled = true; };
  }, []);

function AddExpense({ userId }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        amount: '', payerName: '', category: '', newCategory: '', date: formatDateKey(new Date()),
    });
    const [saveStatus, setSaveStatus] = useState(null);

    // --- Image Scanning State ---
    const [base64ImageData, setBase64ImageData] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);
    const [fileName, setFileName] = useState("No file selected.");
    const [scanStatusMessage, setScanStatusMessage] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    // --- End Scanning State ---

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
        const fileInput = document.getElementById('file-upload');
        if (fileInput) {
            fileInput.value = null; // Clear file input more reliably
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

    // --- 2. useEffect for Handling Shared Images ---
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
      
        const reader = getAppGroupReader();
        if (!reader) {
          console.warn('AppGroupReader plugin not available.');
          return;
        }
      
        let cancelled = false;
      
        (async () => {
          try {
            // 1) List files saved by the Share Extension
            const { files } = await reader.list(); // e.g., ["A1B2.jpg"]
            if (!files || !files.length) return;
      
            // We’ll just take the first pending file
            const name = files[0];
      
            // 2) Read as Base64
            const { data } = await reader.read({ name });
            if (cancelled) return;
      
            // 3) Push into your existing scanner state
            const mime = inferMimeFromName(name);
            setBase64ImageData(data);       // <-- Base64 only
            setImageMimeType(mime);
            setFileName(name);
            setScanStatusMessage("Shared image loaded. Scanning...");
      
            // OPTIONAL: auto-run scan + save flow
            // Wait one tick to allow state to settle
            setTimeout(async () => {
              try {
                // Auto-scan with Gemini
                const extractedData = await callGeminiAPI(data, mime);
      
                setFormData(prev => ({
                  ...prev,
                  amount: extractedData.amount || '',
                  payerName: extractedData.payerName || '',
                  date: extractedData.date || formatDateKey(new Date()),
                }));
      
                const extractedCategory = (extractedData.category || 'UNCATEGORIZED').toUpperCase();
                const match = categories.find(c => c.name === extractedCategory);
                if (match) {
                  setFormData(prev => ({ ...prev, category: match.name, newCategory: '' }));
                } else {
                  setFormData(prev => ({ ...prev, category: '--OTHER--', newCategory: extractedCategory }));
                }
      
                setScanStatusMessage("Scan complete! Saving transaction...");
      
                // Auto-save (reusing your existing Firestore logic)
                // Build the same expenseData you use in handleSaveExpense:
                const expenseData = {
                  amount: parseFloat(extractedData.amount),
                  payerName: (extractedData.payerName || '').trim(),
                  category: match ? match.name : extractedCategory,
                  timestamp: Timestamp.fromDate(new Date((extractedData.date || formatDateKey(new Date())) + 'T00:00:00')),
                  userId: userId,
                };
      
                await addDoc(collection(db, `users/${userId}/expenses`), expenseData);
      
                // Optionally add category if new
                if (!match && extractedCategory) {
                  const exists = categories.find(c => c.name === extractedCategory);
                  if (!exists) {
                    await addDoc(collection(db, `users/${userId}/categories`), {
                      name: extractedCategory,
                      keywords: [extractedCategory],
                      createdAt: Timestamp.now(),
                    });
                  }
                }
      
                setSaveStatus('success');
                setScanStatusMessage("Saved ✓");
      
                // 4) (Important) Remove the file from App Group so it doesn’t re-import next launch
                await reader.remove({ name });
      
                // Reset UI after a bit
                setTimeout(() => {
                  setSaveStatus(null);
                  resetScannerState();
                  setScanStatusMessage(null);
                  setFormData({ amount: '', payerName: '', category: '', newCategory: '', date: formatDateKey(new Date()) });
                }, 1200);
              } catch (e) {
                console.error('Auto scan/save failed:', e);
                setScanStatusMessage(`Auto import failed: ${e.message}`);
              }
            }, 100);
          } catch (e) {
            console.error('AppGroupReader error:', e);
          }
        })();
      
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [userId, categories.length]);

    // --- 3. Function to load image data from file URL (using Filesystem plugin) ---
    const loadImageData = async (fileUrl) => {
        if (!fileUrl) return;

        // Strip file:// prefix if present, as Filesystem plugin often expects just the path
        const filePath = fileUrl.startsWith('file://') ? fileUrl.substring(7) : fileUrl;

        setScanStatusMessage("Loading shared image...");
        try {
            // Read the file as Base64 data
            const loadImageData = async (fileUrl) => {
                if (!fileUrl) return;
            
                // 1. Clean the file path (remove file:// prefix)
                const filePath = fileUrl.startsWith('file://') ? fileUrl.substring(7) : fileUrl;
            
                setScanStatusMessage("Loading shared image...");
                try {
                    // 2. Read the file as base64 using the correct format required by Filesystem
                    const result = await Filesystem.readFile({
                        path: filePath,
                        // 💡 FIX: Use base64 encoding if available, or rely on the plugin's default output 
                        // if we are certain the plugin returns the string correctly.
                        // Since the error is 'cannot parse response', we try reading as BASE64:
                        // NOTE: Capacitor's readFile often returns Base64 implicitly, but we set type.
            
                    });
                    
                    // The data field from Capacitor Filesystem is typically the Base64 string
                    const base64Data = result.data; 
                    
                    let mimeType = "image/jpeg"; // Default
                    // (In a real app, you would determine MIME type from the file name or a separate plugin)
                    
                    // 3. Update state (this should now hold a clean Base64 string)
                    setBase64ImageData(base64Data);
                    setImageMimeType(mimeType);
                    setFileName("Shared Image");
                    setScanStatusMessage("Shared image loaded. Tap Scan to process.");
            
                } catch (error) {
                    console.error("Error reading shared file with Filesystem plugin:", error);
                    setScanStatusMessage(`Error loading shared image data: ${error.message}`);
                    resetScannerState();
                }
            };

            const base64Data = result.data; // Base64 string

            let mimeType = "image/jpeg";
            if (filePath.toLowerCase().endsWith('.png')) mimeType = "image/png";
            if (filePath.toLowerCase().endsWith('.webp')) mimeType = "image/webp";

            setBase64ImageData(base64Data);
            setImageMimeType(mimeType);
            setFileName("Shared Image");
            setScanStatusMessage("Shared image loaded. Tap Scan to process.");

        } catch (error) {
            console.error("Error reading shared file with Filesystem plugin:", error);
            setScanStatusMessage("Error loading shared image data.");
            resetScannerState();
        }
    };


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
            timestamp: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')), // Ensure correct time parsing
            userId: userId,
        };

        try {
            await addDoc(collection(db, `users/${userId}/expenses`), expenseData);

            if (finalCategory === formData.newCategory.trim().toUpperCase() && !categories.find(c => c.name === finalCategory)) {
                await addDoc(collection(db, `users/${userId}/categories`), {
                    name: finalCategory,
                    keywords: newCategoryKeywords,
                    createdAt: Timestamp.now(),
                });
            }

            setSaveStatus('success');
            setFormData({ amount: '', payerName: '', category: '', newCategory: '', date: formatDateKey(new Date()) });
            resetScannerState();
            setTimeout(() => setSaveStatus(null), 3000);

        } catch (error) {
            console.error("Error saving expense:", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 5000);
            alert("Failed to save transaction.");
        }
    };

    // --- 6. Gemini API Call ---
    const callGeminiAPI = async (imageData, imageMimeType) => {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
            throw new Error("Gemini API Key is not configured.");
        }
        
        const keywordMap = {};
        categories.forEach(cat => cat.keywords.forEach(kw => keywordMap[kw.toUpperCase()] = cat.name));
        const mappingString = JSON.stringify(keywordMap);
        
        const systemPrompt = "Analyze the payment receipt screenshot. Extract the data as JSON.";
        const userPrompt = `Extract the following data: 1. amount (number). 2. payerName (string). 3. transaction date (YYYY-MM-DD). Use the mapping ${mappingString} to find the appropriate category based on any text in the receipt. If no match is found, use 'UNCATEGORIZED'. The output MUST be valid JSON.`;
        
        // NOTE: Changed model to a standard vision model for robustness
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
            
            // 💡 FIX: Renamed 'config' to 'generationConfig'
            generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: { 
                    type: "OBJECT", 
                    properties: { 
                        "amount": { "type": "NUMBER" }, 
                        "payerName": { "type": "STRING" }, 
                        "category": { "type": "STRING" }, 
                        "date": { "type": "STRING", "description": "YYYY-MM-DD" } 
                    }, 
                    required: ["amount", "payerName", "category", "date"] 
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

    // --- 7. Scan/Process Handlers ---
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
                payerName: extractedData.payerName || '',
                date: extractedData.date || formatDateKey(new Date()),
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

    return (
        // 💡 FULL JSX RENDERED BELOW
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Column 1: Scanner (UI for File Handling) */}
            <div className="bg-gray-50 p-6 rounded-xl shadow-inner border border-gray-200">
                <h3 className="text-xl font-semibold mb-6 text-gray-800">Scan & Auto-Fill</h3>

                <div className="flex flex-col space-y-4">
                    {/* File Drop Area / Upload */}
                    <div className="border-2 border-gray-300 border-dashed rounded-lg shadow-sm cursor-pointer bg-white hover:bg-gray-50 transition">
                        <label htmlFor="file-upload" className="w-full flex justify-center px-6 py-8">
                            <div className="text-center">
                                {/* SVG for Upload Icon */}
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                <p className="mt-4 text-sm text-gray-600 font-medium">Click to upload or drag & drop</p>
                                <p className="text-xs text-gray-500">{fileName}</p>
                            </div>
                        </label>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleFileSelect} />
                    </div>

                    {/* Paste Button (For iOS Shortcut) */}
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

                {/* Optional: Image Preview Area */}
                {base64ImageData && (
                    <div className="mt-4 p-2 bg-white rounded-lg shadow-inner">
                        <img src={`data:${imageMimeType};base64,${base64ImageData}`} alt="Receipt Preview" className="w-full max-h-48 object-contain rounded" />
                    </div>
                )}
            </div>

            {/* Column 2: Manual Entry Form */}
            <div className="bg-white p-6 rounded-xl shadow-xl">
                <h3 className="text-xl font-semibold mb-6 text-gray-800">Manual Transaction Entry</h3>

                <form onSubmit={handleSaveExpense} className="space-y-4">

                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
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
                        className="w-full py-3 px-4 text-white font-bold bg-green-600 rounded-lg shadow hover:bg-green-700 transition"
                    >
                        Save Transaction
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