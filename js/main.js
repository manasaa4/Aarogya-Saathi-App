// Import Firestore functions from the global window object (set in index.html)
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// --- Global variables to manage state, listeners, timers, and the chart instance ---
let currentUser = null; // Will hold the signed-in user object
let unsubscribeListeners = [];
let notificationInterval = null; 
let weightChartInstance = null; 

// --- Function to unsubscribe from all active Firestore listeners and timers ---
const cleanupListeners = () => {
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = []; 
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
    console.log("Cleaned up old listeners and timers.");
};


// --- UI Setup Function (Handles tabs and BMI calculator) ---
const setupUI = () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const contentSections = document.querySelectorAll('.content-section');
    const defaultTab = 'dashboard';

    const switchTab = (targetTab) => {
        tabButtons.forEach(btn => {
            btn.classList.toggle('tab-active', btn.dataset.tab === targetTab);
        });
        contentSections.forEach(section => {
            section.classList.toggle('active', section.id === targetTab);
        });
    };

    switchTab(defaultTab);

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    // --- BMI Calculator Logic ---
    const calculateBmiBtn = document.getElementById('calculate-bmi');
    calculateBmiBtn.addEventListener('click', () => {
        const bmiHeightInput = document.getElementById('bmi-height');
        const bmiWeightInput = document.getElementById('bmi-weight');
        const bmiResult = document.getElementById('bmi-result');
        const height = parseFloat(bmiHeightInput.value);
        const weight = parseFloat(bmiWeightInput.value);
        if (height > 0 && weight > 0) {
            const heightInMeters = height / 100;
            const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
            let category = '';
            if (bmi < 18.5) category = 'Underweight';
            else if (bmi < 24.9) category = 'Normal weight';
            else if (bmi < 29.9) category = 'Overweight';
            else category = 'Obesity';
            bmiResult.innerHTML = `Your BMI is <span class="text-blue-600 font-bold">${bmi}</span> (${category})`;
        } else {
            bmiResult.textContent = 'Please enter valid height and weight.';
        }
    });
};

// --- Firebase Data Logic (Attaches listeners that depend on the logged-in user) ---
const initializeDataListeners = (user) => {
    const db = window.db;
    const userId = user.uid; 

    // --- State Variables ---
    let vitalsData = [];
    let medsData = [];

    // --- DOM Elements ---
    const vitalsHistory = document.getElementById('vitals-history');
    const medsList = document.getElementById('meds-list');
    const journalHistory = document.getElementById('journal-history');
    const dashboardWeight = document.getElementById('dashboard-weight');
    const dashboardWeightDate = document.getElementById('dashboard-weight-date');
    const dashboardBp = document.getElementById('dashboard-bp');
    const dashboardBpDate = document.getElementById('dashboard-bp-date');
    const dashboardMeds = document.getElementById('dashboard-meds');

    // --- Render Functions ---
    const renderVitalsHistory = (vitals) => {
        vitalsHistory.innerHTML = '';
        if (vitals.length === 0) {
            vitalsHistory.innerHTML = '<p class="text-gray-500">No entries yet.</p>'; return;
        }
        vitals.slice().reverse().forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center';
            const date = entry.date.toDate().toLocaleDateString();
            const time = entry.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            entryDiv.innerHTML = `
                <div>
                    <p class="font-semibold">${date} at ${time}</p>
                    <p class="text-sm text-gray-600">Weight: ${entry.weight ? `${entry.weight} kg` : 'N/A'} | BP: ${entry.bp_sys && entry.bp_dia ? `${entry.bp_sys}/${entry.bp_dia}` : 'N/A'}</p>
                </div>
                <button data-id="${entry.id}" class="delete-vitals-btn text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
            `;
            vitalsHistory.appendChild(entryDiv);
        });
    };

    const renderMedsList = (meds) => {
        medsList.innerHTML = '';
        if (meds.length === 0) {
            medsList.innerHTML = '<p class="text-gray-500">No medications added yet.</p>'; return;
        }
        meds.forEach(med => {
            const medDiv = document.createElement('div');
            medDiv.className = 'bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center';
            medDiv.innerHTML = `<div><p class="font-bold ${med.taken ? 'line-through text-gray-400' : ''}">${med.name}</p><p class="text-sm text-gray-600">${med.dose || ''} ${med.time ? `at ${med.time}` : ''}</p></div><div class="flex items-center space-x-4"><label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" data-id="${med.id}" class="med-taken-checkbox h-5 w-5 rounded" ${med.taken ? 'checked' : ''}><span class="text-sm">Taken</span></label><button data-id="${med.id}" class="delete-med-btn text-red-500 hover:text-red-700 font-bold text-lg">&times;</button></div>`;
            medsList.appendChild(medDiv);
        });
    };

    const renderJournalHistory = (entries) => {
        journalHistory.innerHTML = '';
        if (entries.length === 0) {
            journalHistory.innerHTML = '<p class="text-gray-500">No journal entries yet.</p>'; return;
        }
        entries.slice().reverse().forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'bg-white p-4 rounded-lg shadow-sm border relative';
            const date = entry.date.toDate().toLocaleString();
            entryDiv.innerHTML = `
                <button data-id="${entry.id}" class="delete-journal-btn text-red-500 hover:text-red-700 font-bold text-lg absolute top-2 right-3">&times;</button>
                <p class="text-sm text-gray-500 mb-2">${date}</p>
                <p class="pr-6">${entry.text.replace(/\n/g, '<br>')}</p>
            `;
            journalHistory.appendChild(entryDiv);
        });
    };

    const updateDashboard = () => {
        const lastVitalWithWeight = vitalsData.slice().reverse().find(v => v.weight);
        if (lastVitalWithWeight) {
            dashboardWeight.textContent = `${lastVitalWithWeight.weight} kg`;
            dashboardWeightDate.textContent = `on ${lastVitalWithWeight.date.toDate().toLocaleDateString()}`;
        }
        const lastVitalWithBp = vitalsData.slice().reverse().find(v => v.bp_sys && v.bp_dia);
        if (lastVitalWithBp) {
            dashboardBp.textContent = `${lastVitalWithBp.bp_sys}/${lastVitalWithBp.bp_dia}`;
            dashboardBpDate.textContent = `on ${lastVitalWithBp.date.toDate().toLocaleDateString()}`;
        }
        const totalMeds = medsData.length;
        const takenMeds = medsData.filter(m => m.taken).length;
        dashboardMeds.textContent = `${takenMeds} / ${totalMeds}`;
    };

    const renderWeightChart = () => {
        const vitalsWithWeight = vitalsData.filter(v => v.weight);
        const ctx = document.getElementById('weightChart').getContext('2d');
        const labels = vitalsWithWeight.map(v => v.date.toDate().toLocaleDateString());
        const data = vitalsWithWeight.map(v => v.weight);
        if (weightChartInstance) weightChartInstance.destroy();
        weightChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Weight (kg)', data: data, borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.1, fill: true }] }, options: { responsive: true, scales: { y: { beginAtZero: false } } } });
    };
    
    // --- Firestore Real-Time Listeners ---
    const vitalsUnsubscribe = onSnapshot(query(collection(db, 'users', userId, 'vitals'), orderBy('date', 'asc')), (snapshot) => {
        vitalsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderVitalsHistory(vitalsData);
        updateDashboard();
        renderWeightChart();
    });
    unsubscribeListeners.push(vitalsUnsubscribe);

    const medsUnsubscribe = onSnapshot(query(collection(db, 'users', userId, 'meds')), (snapshot) => {
        medsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMedsList(medsData);
        updateDashboard();
    });
    unsubscribeListeners.push(medsUnsubscribe);

    const journalUnsubscribe = onSnapshot(query(collection(db, 'users', userId, 'journal'), orderBy('date', 'asc')), (snapshot) => {
        const journalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderJournalHistory(journalData);
    });
    unsubscribeListeners.push(journalUnsubscribe);

    // --- Notifications Logic ---
    const checkMedicationNotifications = () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        medsData.forEach(med => {
            if (med.time === currentTime && !med.taken) {
                new Notification('Medication Reminder', {
                    body: `It's time to take your ${med.name} (${med.dose}).`,
                    icon: './favicon.ico' 
                });
            }
        });
    };
    if (Notification.permission !== 'granted') Notification.requestPermission();
    notificationInterval = setInterval(checkMedicationNotifications, 60000);
};

// --- Function to clear all visible user data from the UI ---
const clearAllDataUI = () => {
    document.getElementById('vitals-history').innerHTML = '<p class="text-gray-500">No entries yet.</p>';
    document.getElementById('meds-list').innerHTML = '<p class="text-gray-500">No medications added yet.</p>';
    document.getElementById('journal-history').innerHTML = '<p class="text-gray-500">No journal entries yet.</p>';
    document.getElementById('dashboard-weight').textContent = '-- kg';
    document.getElementById('dashboard-weight-date').textContent = 'No data yet';
    document.getElementById('dashboard-bp').textContent = '--/--';
    document.getElementById('dashboard-bp-date').textContent = 'No data yet';
    document.getElementById('dashboard-meds').textContent = '0 / 0';
    
    if (weightChartInstance) {
        weightChartInstance.destroy();
        weightChartInstance = null;
    }
};

// --- Main Entry Point: Runs when the page is fully loaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Get Firebase functions from the global window object
    const auth = window.auth;
    const db = window.db;
    const onAuthStateChanged = window.onAuthStateChanged;
    const GoogleAuthProvider = window.GoogleAuthProvider;
    const signInWithPopup = window.signInWithPopup;
    const signOut = window.signOut;

    // --- DOM Elements for Auth and Forms ---
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userDetails = document.getElementById('user-details');
    const vitalsForm = document.getElementById('vitals-form');
    const medsForm = document.getElementById('meds-form');
    const journalForm = document.getElementById('journal-form');
    const vitalsHistory = document.getElementById('vitals-history');
    const medsList = document.getElementById('meds-list');
    const journalHistory = document.getElementById('journal-history');
    const medImageInput = document.getElementById('med-image-input');
    
    // Set up the basic UI (tabs, BMI calc) that doesn't need a user
    setupUI();

    // --- Event Listeners (Defined ONCE) ---

    // Auth Listeners
    onAuthStateChanged(auth, user => {
        cleanupListeners();
        clearAllDataUI();
        currentUser = user; // Update the global user state

        if (user) {
            loginScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            userDetails.textContent = `Welcome, ${user.displayName}`;
            initializeDataListeners(user);
        } else {
            appContainer.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            userDetails.textContent = '';
        }
    });

    signInBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => console.error("Sign-in error", error));
    });

    signOutBtn.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Sign-out error", error));
    });

    // Form Submission Listeners
    vitalsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const newEntry = {
            date: new Date(),
            weight: document.getElementById('weight').value ? parseFloat(document.getElementById('weight').value) : null,
            bp_sys: document.getElementById('bp_sys').value ? parseInt(document.getElementById('bp_sys').value) : null,
            bp_dia: document.getElementById('bp_dia').value ? parseInt(document.getElementById('bp_dia').value) : null,
        };
        await addDoc(collection(db, 'users', currentUser.uid, 'vitals'), newEntry);
        vitalsForm.reset();
    });

    medsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const newMed = {
            name: document.getElementById('med-name').value,
            dose: document.getElementById('med-dose').value,
            time: document.getElementById('med-time').value,
            taken: false
        };
        await addDoc(collection(db, 'users', currentUser.uid, 'meds'), newMed);
        medsForm.reset();
    });

    journalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const text = document.getElementById('journal-entry').value.trim();
        if (!text) return;
        await addDoc(collection(db, 'users', currentUser.uid, 'journal'), { date: new Date(), text });
        journalForm.reset();
    });

    // Delete and Update Listeners (Event Delegation)
    vitalsHistory.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-vitals-btn')) {
            const id = e.target.dataset.id;
            if (!currentUser || !id) return;
            await deleteDoc(doc(db, 'users', currentUser.uid, 'vitals', id));
        }
    });

    journalHistory.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-journal-btn')) {
            const id = e.target.dataset.id;
            if (!currentUser || !id) return;
            await deleteDoc(doc(db, 'users', currentUser.uid, 'journal', id));
        }
    });

    medsList.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!currentUser || !id) return;
        const medRef = doc(db, 'users', currentUser.uid, 'meds', id);
        if (target.classList.contains('med-taken-checkbox')) {
            await updateDoc(medRef, { taken: target.checked });
        }
        if (target.classList.contains('delete-med-btn')) {
            await deleteDoc(medRef);
        }
    });

    // OCR Listener
    medImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const ocrStatus = document.getElementById('ocr-status');
        const medNameInput = document.getElementById('med-name');
        if (!file) return;

        ocrStatus.textContent = 'Processing image...';
        try {
            const worker = await Tesseract.createWorker('eng');
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-. ',
            });
            const { data: { text } } = await worker.recognize(file);
            await worker.terminate();

            // Intelligent text filtering
            const lines = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 2 && /[a-zA-Z]/.test(line)); // Must be longer than 2 chars and contain a letter
            
            const bestGuess = lines.reduce((a, b) => a.length > b.length ? a : b, ''); // Find the longest valid line
            
            medNameInput.value = bestGuess || 'Could not read name';
            ocrStatus.textContent = 'Text extracted!';
        } catch (error) {
            console.error('OCR Error:', error);
            ocrStatus.textContent = 'Could not read text from image.';
        } finally {
            setTimeout(() => ocrStatus.textContent = '', 3000);
        }
    });
});

