# Aarogya-Saathi-App

Aarogya Saathi - Your Personal Health Dashboard
Aarogya Saathi is a secure, client-side web application designed to be a simple and effective personal health companion. It allows users to track their vital signs, manage medications, and keep a personal health journal, with all data securely stored and synced in the cloud using Firebase.

# ✨Key Features
Secure Google Sign-In: Users can securely log in with their Google account, ensuring their health data is private and accessible across devices.

Dashboard Overview: A clean dashboard provides an at-a-glance view of the latest weight, blood pressure readings, and medication adherence.

Vitals Tracking: Easily log and view a history of important vitals like weight and blood pressure. Includes a trend graph for weight.

Medication Management: Add medications, specify dosages, and set reminders. The app can send browser notifications when it's time to take a dose.

📸 OCR for Medicine Names: Simply upload a photo of a medicine package, and the app will automatically extract the name using Optical Character Recognition (OCR), making it easy for users who have difficulty typing.

Symptom Journal: Keep a daily log of symptoms or feelings to track your health journey over time.

BMI Calculator: A simple utility to quickly calculate your Body Mass Index.

# 💻 Tech Stack
This project is built using modern, client-side web technologies:

Frontend: HTML5, CSS3, JavaScript (ES6 Modules)

Styling: Tailwind CSS for a utility-first design system.

Backend & Database: Google Firebase (Firestore for database and Authentication for user login).

Charting: Chart.js for rendering the weight trend graph.

OCR: Tesseract.js for client-side text recognition from images.

# 🚀 Getting Started
To run this project locally, you will need a modern web browser and a code editor like VS Code.

1. Clone the Repository
First, get a copy of the project on your local machine.

git clone https://github.com/manasaa4/Aarogya-Saathi-App.git
cd Aarogya-Saathi-App

2. Set Up Your Firebase Project
This application requires a Firebase backend to function.

Go to the Firebase Console and create a new project.

Add a Web App to your project to get your firebaseConfig keys.

Enable Firestore Database: Create a new Firestore database and start it in Test Mode.

Enable Authentication:

Go to the Authentication section.

Under the "Sign-in method" tab, enable the Google provider.

Under the "Settings" tab, add 127.0.0.1 to the list of Authorized domains.

Copy your firebaseConfig object into the <script> tag at the bottom of the index.html file, replacing the placeholder values.

3. Run the Application
Because this project uses JavaScript modules, it must be served by a web server to avoid CORS errors. The easiest way to do this is with the Live Server extension in VS Code.

Install the Live Server extension from the VS Code Marketplace.

Open the project folder in VS Code.

Right-click on the index.html file and select "Open with Live Server" (or click the "Go Live" button in the bottom-right corner).

The application will open in your default browser, and you can start using it by signing in with your Google account.
