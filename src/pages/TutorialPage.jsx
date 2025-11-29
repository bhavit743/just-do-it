import React from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for the back button
import Accordion from '../components/common/Accordion';
import { StatusBar, Style } from '@capacitor/status-bar'; // Import StatusBar for consistent styling
import { useEffect } from 'react';

// Icon Components (using Font Awesome classes directly)
const ActivityIcon = ({ className }) => <i className={`fas fa-running ${className}`}></i>;
const ExpenseIcon = ({ className }) => <i className={`fas fa-credit-card ${className}`}></i>;
const ShortcutIcon = ({ className }) => <i className={`fas fa-share-alt ${className}`}></i>;

function TutorialPage() {
  const navigate = useNavigate();

  // StatusBar styling for this page
  useEffect(() => {
    const setStatusBarStyle = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {
        // Ignore if running on web
      }
    };
    setStatusBarStyle();
  }, []);

  return (
 
     
        <div className="bg-white p-6 rounded-xl shadow-xl space-y-6"> {/* Added space-y-6 for vertical spacing */}
          <h2 className="text-3xl font-bold text-gray-800 mb-2">How to Use JustDoIt</h2>
          <p className="text-gray-600 mb-6">
            Welcome! Here's a quick guide to help you get started with all the features of JustDoIt.
            Tap on any section below to expand and read the steps.
          </p>

          <Accordion title="Activity Tracker" icon={ActivityIcon}>
            <p>The Activity Tracker helps you build consistent habits.</p>
            <ol className="list-decimal pl-5 space-y-2"> {/* Added basic list styling */}
              <li><strong>Manage Goals:</strong> First, go to the "Activity" tab and click "Manage KPIs" to add the daily goals you want to track (e.g., "Exercise", "Read 10 Pages").</li>
              <li><strong>Mark Completion:</strong> On the "Today" tab, just tap the circle next to a goal to mark it as complete for the day.</li>
              <li><strong>View Streaks:</strong> The "Streaks" tab shows your current consecutive day streak for each goal.</li>
              <li><strong>Edit Past Dates:</strong> On the "Calendar" tab, you can tap any past date to open a modal and edit your completion history.</li>
            </ol>
          </Accordion>

          <Accordion title="Expense Tracker" icon={ExpenseIcon}>
            <p>The Expense Tracker helps you log and review your spending.</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Add/Scan:</strong> In the "Add Expense" tab, you can either enter a transaction manually or use the "Scan" button to auto-fill the form with AI.</li>
              <li><strong>List:</strong> The "Full List" tab shows all your transactions. You can filter by month, delete items, or tap the pencil icon to edit any past expense.</li>
              <li><strong>Summary:</strong> This tab shows a chart of your spending by category for the selected month.</li>
              <li><strong>Categories:</strong> Here you can create custom categories, assign them a color, and add keywords (like "ZOMATO") to help the AI auto-categorize your scans.</li>
              <li><strong>Batch Upload:</strong> Use this page (linked from the "Add Expense" tab) to upload multiple receipts at once for scanning.</li>
            </ol>
          </Accordion>
          
          <Accordion title="Background Upload Shortcut (iOS)" icon={ShortcutIcon}>
            <p>This is an advanced feature that lets you scan receipts from your Photo Library without opening the app. It requires a one-time setup.</p>
            
            <h4 className="font-semibold mt-4 mb-2">Part A: Get the iOS Shortcut</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li>On your iPhone, <a href="https://www.icloud.com/shortcuts/326201108de4429293c197dbd719d6e7" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">tap this link to get the "Scan Receipt" shortcut</a>.</li>
              <li>Tap "Add Shortcut".</li>
            </ol>
            
            <h4 className="font-semibold mt-4 mb-2">Part B: Get Your Secret URL</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li>In this app, click your "Profile" button.</li>
              <li>On your profile page, find the "Background Upload Shortcut" section.</li>
              <li>Tap the "Copy to Clipboard" button. This copies your unique, secret URL.</li>
            </ol>
            
            <h4 className="font-semibold mt-4 mb-2">Part C: Configure the Shortcut</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Open the Shortcuts** app on your iPhone.</li>
              <li>Find the "Scan Receipt" shortcut you just added and tap the **three dots (...)** to edit it.</li>
              <li>Find the first action, which is a "Text" box.</li>
              <li>Delete the placeholder URL inside that text box.</li>
              <li>Paste your secret URL from your clipboard.</li>
              <li>Tap "Done" at the top right.</li>
            </ol>
            
            <p className="mt-4">That's it! Now, go to any image in your Photos app, tap the "Share" icon, and select "Scan" from the list. The shortcut will run in the background and the expense will appear in your app.</p>
          </Accordion>

        </div>
  );
}

export default TutorialPage;