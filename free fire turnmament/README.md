# Professional Free Fire Tournament Platform (AETHER)

A fully functional, agentic tournament management system for Free Fire, featuring a unique **AdSense Reward Hub** for user earning.

## 🚀 Key Features
- **Dynamic AdSense Integration**: Controlled via the Admin Panel. No code changes required to move from Test to Live ads.
- **Ad Reward Hub**: Continuous rewarded ad loop using Google Publisher Tag (GPT) allowing users to earn Ad Coins.
- **1.2x Earning Ratio**: Smart economy where ad-supported entries are valued at 120% of cash entries.
- **Automated Policy System**: Legally compliant Terms of Service (extensive), Privacy Policy, and Refund Policy.
- **Admin Dashboard**: Create matches, manage wallets, verify results, and distribute prizes.
- **Smart UID Fetching**: Automatically fetches player IGN, Level, and Region from multiple API backends.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+).
- **Backend**: Python Flask API (RESTful).
- **Database**: Local JSON storage (for production stability without SQL overhead).
- **Auth/Storage**: Firebase (Google Login & real-time sync).

## 📥 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/freefire-tournament.git
   cd freefire-tournament
   ```

2. **Setup Python Environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Run the Server**:
   ```bash
   python start_server.py
   ```

## ⚙️ Admin Setup
1. Open the browser to `localhost:8000`.
2. Access the hidden admin dashboard at `admin-settings.html`.
3. Input your **Google AdSense Client ID** and **Reward Ad Unit Path** to activate monetization.

## ⚖️ Legal Disclaimer
This platform includes a "Risk is Yours" clause. Use of the platform for real-money tournaments must comply with your local regional laws regarding skill-based gaming.
