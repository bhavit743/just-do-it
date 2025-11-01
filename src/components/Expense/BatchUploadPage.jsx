// src/pages/BatchUploadPage.jsx
import React, { useState, useEffect } from 'react';
// ⛔ REMOVED: import { useOutletContext } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

// !!! IMPORTANT: YOUR GEMINI API KEY IS HERE. DO NOT COMMIT TO GITHUB. !!!
// You should move this to a .env file.
const GEMINI_API_KEY = "AIzaSyAZJOfCX_WZmXb1bD0lU0-8pn5LPCKNxGA";

// ✅ UPDATED: Now accepts userId as a prop
function BatchUploadPage({ userId }) { 
    // ⛔ REMOVED: const { user } = useOutletContext(); 
    // ⛔ REMOVED: const userId = user?.uid;

    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [fileQueue, setFileQueue] = useState([]); // Stores { id, file, status, message }
    const [isProcessing, setIsProcessing] = useState(false);

    // Utility: Format date to YYYY-MM-DD
    function formatDateKey(date) {
        return new Date(date).toISOString().slice(0, 10);
    }

    // 1. Fetch Categories (same as AddExpense)
    useEffect(() => {
        if (!userId) return; // This guard will now work correctly
        const catQuery = query(collection(db, `users/${userId}/categories`), orderBy("name"));
        const unsubscribe = onSnapshot(catQuery, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(catList);
            setLoadingCategories(false);
        }, (err) => {
            console.error("Category Fetch Error:", err);
            setLoadingCategories(false);
        });
        return () => unsubscribe();
    }, [userId]); // The dependency on userId is correct

    // 2. Handle file selection
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const newFileQueue = files.map((file, index) => ({
            id: `${file.name}-${index}`,
            file: file,
            status: 'pending', // 'pending', 'scanning', 'saved', 'error'
            message: null,
        }));
        setFileQueue(newFileQueue);
    };

    // 3. Helper to read a file as Base64
    const processFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const parts = event.target.result.split(',');
                const base64 = parts[1];
                const mime = parts[0].match(/:(.*?);/)[1];
                resolve({ base64, mime });
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsDataURL(file);
        });
    };

    // 4. Gemini API Call (Copied from AddExpense.jsx)
    const callGeminiAPI = async (imageData, imageMimeType) => {
        if (!GEMINI_API_KEY) {
            throw new Error("Gemini API Key is not configured correctly.");
        }
        
        const keywordMap = {};
        categories.forEach(cat => cat.keywords.forEach(kw => keywordMap[kw.toUpperCase()] = cat.name));
        const mappingString = JSON.stringify(keywordMap);
        
        const systemPrompt = "Analyze the payment receipt screenshot. Extract the data as JSON.";
        const userPrompt = `Extract the following data: 1. amount (number). 2. merchantName (string, the store, business, or person *receiving* the payment. Do NOT extract the sender's name). 3. transaction date (YYYY-MM-DD). Use the mapping ${mappingString} to find the appropriate category. If no match, use 'UNCATEGORIZED'. The output MUST be valid JSON.`;

        const apiUrl = `https://generativelaNguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
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
            throw new Error(`API failed: ${errorBody.error?.message || response.statusText}`);
        }
        
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) throw new Error("No text response from API.");
        return JSON.parse(jsonText);
    };

    // 5. Save Logic (modified for batch)
    const saveExpense = async (extractedData) => {
        let finalCategory = (extractedData.category || 'UNCATEGORIZED').toUpperCase();
        const categoryMatch = categories.find(c => c.name === finalCategory);

        if (!finalCategory) finalCategory = 'UNCATEGORIZED';

        const expenseData = {
            amount: parseFloat(extractedData.amount || 0),
            payerName: (extractedData.merchantName || 'Unknown').trim(),
            category: finalCategory,
            timestamp: Timestamp.fromDate(new Date((extractedData.date || formatDateKey(new Date())) + 'T00:00:00')),
            userId: userId, // This will now be correctly populated
        };

        // Add the expense
        await addDoc(collection(db, `users/${userId}/expenses`), expenseData);

        // Add new category if it doesn't exist
        if (!categoryMatch && finalCategory !== 'UNCATEGORIZED') {
            await addDoc(collection(db, `users/${userId}/categories`), {
                name: finalCategory,
                keywords: [finalCategory],
                createdAt: Timestamp.now(),
            });
        }
    };

    // 6. Main Batch Processing Function
    const handleBatchScanAndSave = async () => {
        setIsProcessing(true);

        for (const item of fileQueue) {
            setFileQueue(prev => prev.map(f => 
                f.id === item.id ? { ...f, status: 'scanning' } : f
            ));

            try {
                const { base64, mime } = await processFile(item.file);
                const extractedData = await callGeminiAPI(base64, mime);
                await saveExpense(extractedData);
                setFileQueue(prev => prev.map(f => 
                    f.id === item.id ? { ...f, status: 'saved', message: `Saved: ${extractedData.merchantName} (Rs. ${extractedData.amount})` } : f
                ));
            } catch (err) {
                console.error("Error processing file:", item.file.name, err);
                setFileQueue(prev => prev.map(f => 
                    f.id === item.id ? { ...f, status: 'error', message: err.message } : f
                ));
            }
        }

        setIsProcessing(false);
    };

    // Helper for status colors
    const getStatusColor = (status) => {
        if (status === 'saved') return 'text-green-600';
        if (status === 'error') return 'text-red-600';
        if (status === 'scanning') return 'text-blue-600';
        return 'text-gray-500';
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-xl max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-text-dark mb-6">Batch Expense Uploader</h2>
            
            {loadingCategories ? (
                <p>Loading categories...</p>
            ) : (
                <div className="space-y-6">
                    {/* --- 1. Uploader --- */}
                    <div className="border-2 border-primary border-dashed rounded-xl shadow-sm cursor-pointer bg-white hover:bg-primary-light transition p-8">
                        <label htmlFor="batch-file-upload" className="w-full flex justify-center">
                            <div className="text-center">
                                <i className="fas fa-images text-4xl text-primary mb-4"></i>
                                <p className="mt-4 text-sm text-primary font-semibold">Click to select multiple images (max 10)</p>
                                <p className="text-xs text-text-muted">You have selected {fileQueue.length} file(s).</p>

                            </div>
                        </label>
                        <input 
                            id="batch-file-upload" 
                            name="batch-file-upload" 
                            type="file" 
                            className="sr-only" 
                            accept="image/png, image/jpeg, image/webp" 
                            multiple
                            onChange={handleFileSelect} 
                        />
                    </div>

                    {/* --- 2. Action Button --- */}
                    <button
                        onClick={handleBatchScanAndSave}
                        className={`w-full py-3.5 px-4 text-sm font-bold text-black rounded-full shadow-lg transition ${isProcessing || fileQueue.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-blue-500'}`}
                        disabled={isProcessing || fileQueue.length === 0}
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24"></svg>
                                Processing...
                            </span>
                        ) : (
                            `Scan & Save All ${fileQueue.length} Receipts`
                        )}
                    </button>

                    {/* --- 3. Results List --- */}
                    {fileQueue.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-text-dark">Upload Queue</h3>
                            <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                                {fileQueue.map(item => (
                                    <li key={item.id} className="p-4 flex justify-between items-center">
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm font-medium text-text-dark truncate">{item.file.name}</p>
                                            <p className={`text-xs font-medium ${getStatusColor(item.status)}`}>
                                                {item.status === 'scanning' && 'Scanning...'}
                                                {item.status === 'pending' && 'Pending...'}
                                                {item.status === 'saved' && `✓ ${item.message}`}
                                                {item.status === 'error' && `✗ Error: ${item.message}`}
                                            </p>
                                        </div>
                                        {item.status === 'scanning' && (
                                            <svg className="animate-spin h-5 w-5 text-blue-500 ml-3" viewBox="0 0 24 24"></svg>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

export default BatchUploadPage;