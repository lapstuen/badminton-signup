//
//  BadmintonWalletManagerApp.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import SwiftUI
import FirebaseCore

@main
struct BadmintonWalletManagerApp: App {

    init() {
        // Configure Firebase
        FirebaseApp.configure()
        print("🔥 Firebase configured successfully")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
