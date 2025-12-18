# Ad Implementation Guide for Aether Tournament App

## Overview
This platform is set up with a **Hybrid Ad System**.
1. **Ad Coins**: Users earn "Ad Coins" by watching ads.
2. **Payment**: Users can pay for tournaments using these Ad Coins.

## Current Implementation (Mock)
Currently, the `handleWatchAd()` function in `dashboard.html` simulates an ad by waiting 5 seconds.

```javascript
// dashboard.html
async function handleWatchAd() {
    // ... basic UI updates ...
    await new Promise(r => setTimeout(r, 5000)); // Mock Delay
    // ... credit ad coin ...
}
```

## How to Add Real AdMob (for Android/iOS App)
If you are wrapping this website into an Android App (using WebView, Capacitor, or similar), you need to interface with the native AdMob SDK.

### Step 1: Interface with JavaScript
In your Android Java/Kotlin code, inject a JavaScript Interface.

**Android Code (Example):**
```java
// On your WebView
webView.addJavascriptInterface(new WebAppInterface(this), "Android");

public class WebAppInterface {
    Context mContext;
    WebAppInterface(Context c) { mContext = c; }

    @JavascriptInterface
    public void showAd() {
        // Call your AdMob Rewarded Video Show logic here
        runOnUiThread(() -> {
            if (mRewardedVideoAd.isLoaded()) {
                mRewardedVideoAd.show();
            }
        });
    }
}
```

### Step 2: Call Android from Website
Update `dashboard.html`:

```javascript
async function handleWatchAd() {
    const btn = document.querySelector('#ad-watch-section button');
    btn.disabled = true;
    
    // Check if running in Android Wrapper
    if (window.Android && window.Android.showAd) {
        window.Android.showAd(); 
        
        // You need a callback function that Android calls when Ad is finished
        window.onAdFinished = async () => {
            await db.watchAd(currentUser.email);
            // ... update UI ...
        };
    } else {
        // Fallback or Web Ad (AdSense)
        alert("Ads only available on Mobile App");
    }
}
```

## How to Add Web Ads (AdSense / Monetag)
If running purely on the web, use a "Rewarded Ad" provider for Web.

1. Sign up for **Monetag** or **Google AdSense**.
2. Get your `Direct Link` or `JS Tag`.
3. Update `handleWatchAd` to open the link or show the JS popup.

```javascript
async function handleWatchAd() {
   // Example: Open ad in new window and wait
   window.open('YOUR_AD_LINK_HERE', '_blank');
   
   // Web ads are harder to verify "completion". 
   // Usually you use a provider SDK (like Unity Ads for Web).
   
   // For now, we assume if they clicked, they watched:
   setTimeout(async () => {
       await db.watchAd(currentUser.email);
       // Update UI...
   }, 10000); // 10 seconds check
}
```
