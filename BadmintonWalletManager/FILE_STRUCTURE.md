# 📁 File Structure

Complete list of all files in the BadmintonWalletManager iOS app.

```
BadmintonWalletManager/
│
├── 📱 App Entry Point
│   └── BadmintonWalletManagerApp.swift    (247 lines)
│       - Firebase initialization
│       - App lifecycle management
│
├── 🗂️ Models/
│   ├── User.swift                         (28 lines)
│   │   - User data structure
│   │   - Balance color logic
│   │
│   └── Transaction.swift                  (51 lines)
│       - Transaction data structure
│       - Firestore timestamp handling
│       - Formatted display strings
│
├── 🔥 Services/
│   └── FirebaseManager.swift              (205 lines)
│       - Real-time Firestore listeners
│       - User CRUD operations
│       - Balance management
│       - Transaction recording
│       - Error handling
│
├── 🎨 Views/
│   ├── ContentView.swift                  (186 lines)
│   │   - Main user list screen
│   │   - Search functionality
│   │   - Summary header with totals
│   │   - User row components
│   │   - Empty state
│   │
│   ├── UserDetailView.swift               (414 lines)
│   │   - User detail screen
│   │   - Balance display with indicators
│   │   - Quick top-up buttons (150/300/450/600)
│   │   - Custom amount entry
│   │   - Top-up and deduction actions
│   │   - Transaction history navigation
│   │   - Edit user screen (password, delete)
│   │
│   └── TransactionHistoryView.swift       (247 lines)
│       - Individual user transactions
│       - All transactions view (admin)
│       - Transaction row components
│       - Search and filter
│       - Empty states
│
├── 📖 Documentation/
│   ├── README.md                          (Full setup guide)
│   ├── QUICKSTART.md                      (10-minute setup)
│   └── FILE_STRUCTURE.md                  (This file)
│
└── 🚫 .gitignore
    - Xcode files
    - Firebase credentials
    - Build artifacts

```

## Total Statistics

- **Swift Files**: 9 files
- **Total Lines**: ~1,378 lines of SwiftUI code
- **Views**: 3 main views + 4 subviews
- **Models**: 2 models
- **Services**: 1 Firebase manager
- **Documentation**: 3 markdown files

## Key Features Per File

### BadmintonWalletManagerApp.swift
- ✅ Firebase initialization
- ✅ App lifecycle hooks

### User.swift
- ✅ User model with Codable
- ✅ Balance level calculation
- ✅ Color-coded balance states

### Transaction.swift
- ✅ Transaction model with Codable
- ✅ Firestore timestamp conversion
- ✅ Formatted display helpers
- ✅ Debit/credit detection

### FirebaseManager.swift
- ✅ Real-time user listeners
- ✅ CRUD operations for users
- ✅ Balance update operations
- ✅ Transaction recording
- ✅ Transaction fetching (user/all)
- ✅ Top-up helper method
- ✅ Deduction helper method
- ✅ Error handling

### ContentView.swift
- ✅ User list with real-time updates
- ✅ Search functionality
- ✅ Summary header (user count, total balance)
- ✅ Navigation to user details
- ✅ Color-coded user rows
- ✅ Balance indicators
- ✅ Empty state view
- ✅ All transactions sheet

### UserDetailView.swift
- ✅ Current balance display
- ✅ Color-coded balance indicator
- ✅ Quick top-up buttons (4 presets)
- ✅ Custom amount entry
- ✅ Description field
- ✅ Add to balance action
- ✅ Deduct from balance action
- ✅ View transaction history
- ✅ Edit user (password)
- ✅ Delete user (with confirmation)
- ✅ Success/error alerts
- ✅ Loading states

### TransactionHistoryView.swift
- ✅ Individual user transactions
- ✅ All transactions view
- ✅ Search/filter functionality
- ✅ Transaction row components
- ✅ Debit/credit indicators
- ✅ Formatted dates and amounts
- ✅ Empty states
- ✅ Real-time loading

## Usage Flow

```
ContentView (User List)
    │
    ├──→ Search Users
    ├──→ View Summary Stats
    ├──→ Tap User → UserDetailView
    │                    │
    │                    ├──→ View Balance
    │                    ├──→ Quick Top-up
    │                    ├──→ Custom Amount
    │                    ├──→ Deduct Balance
    │                    ├──→ View Transactions → TransactionHistoryView
    │                    └──→ Edit User → EditUserView
    │
    └──→ View All Transactions → AllTransactionsView
```

## Firebase Collections Used

1. **authorizedUsers** (read/write)
   - User profiles
   - Balance tracking
   - Password management

2. **transactions** (read/write)
   - Transaction history
   - Top-ups and deductions
   - Timestamps and descriptions

## Next Steps

After creating the Xcode project:

1. ✅ Add all Swift files to project
2. ✅ Add `GoogleService-Info.plist`
3. ✅ Add Firebase SDK via SPM
4. ✅ Build and run
5. ✅ Test with your Firebase data

---

**All files are ready to use!** Just follow the QUICKSTART.md guide.
