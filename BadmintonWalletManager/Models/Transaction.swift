//
//  Transaction.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import Foundation
import FirebaseFirestore

struct Transaction: Identifiable, Codable {
    let id: String
    let userId: String
    let userName: String
    let amount: Double
    let description: String
    let timestamp: Date

    var isDebit: Bool {
        return amount < 0
    }

    var formattedAmount: String {
        let sign = amount >= 0 ? "+" : ""
        return "\(sign)\(Int(amount)) THB"
    }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }
}

// Helper to decode Firestore Timestamp
extension Transaction {
    init(id: String, data: [String: Any]) {
        self.id = id
        self.userId = data["userId"] as? String ?? ""
        self.userName = data["userName"] as? String ?? ""
        self.amount = data["amount"] as? Double ?? 0
        self.description = data["description"] as? String ?? ""

        if let timestamp = data["timestamp"] as? Timestamp {
            self.timestamp = timestamp.dateValue()
        } else {
            self.timestamp = Date()
        }
    }
}
