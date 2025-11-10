//
//  User.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import Foundation

struct User: Identifiable, Codable {
    let id: String
    var name: String
    var balance: Double
    var password: String
    var role: String?
    var regularDays: [Int]?

    var balanceColor: BalanceLevel {
        if balance < 150 { return .low }
        if balance < 450 { return .medium }
        return .high
    }

    enum BalanceLevel {
        case low, medium, high
    }
}
