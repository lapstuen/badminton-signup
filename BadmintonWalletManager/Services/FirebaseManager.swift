//
//  FirebaseManager.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import Foundation
import FirebaseFirestore
import Combine

@MainActor
class FirebaseManager: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var usersListener: ListenerRegistration?

    init() {
        setupRealtimeListeners()
    }

    deinit {
        usersListener?.remove()
    }

    // MARK: - Real-time Listeners

    func setupRealtimeListeners() {
        print("🔥 Setting up real-time listeners...")

        usersListener = db.collection("authorizedUsers")
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }

                if let error = error {
                    print("❌ Error fetching users: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    return
                }

                self.users = snapshot?.documents.compactMap { doc in
                    let data = doc.data()
                    return User(
                        id: doc.documentID,
                        name: data["name"] as? String ?? "",
                        balance: data["balance"] as? Double ?? 0,
                        password: data["password"] as? String ?? "",
                        role: data["role"] as? String,
                        regularDays: data["regularDays"] as? [Int]
                    )
                } ?? []

                print("✅ Loaded \(self.users.count) users")
            }
    }

    // MARK: - User Management

    func updateBalance(userId: String, newBalance: Double) async throws {
        print("💰 Updating balance for user \(userId) to \(newBalance) THB")

        try await db.collection("authorizedUsers")
            .document(userId)
            .updateData(["balance": newBalance])

        print("✅ Balance updated successfully")
    }

    func addUser(name: String, password: String, initialBalance: Double = 0) async throws {
        print("👤 Adding new user: \(name)")

        try await db.collection("authorizedUsers").addDocument(data: [
            "name": name,
            "password": password,
            "balance": initialBalance,
            "createdAt": Firestore.Timestamp(date: Date())
        ])

        print("✅ User added successfully")
    }

    func deleteUser(userId: String) async throws {
        print("🗑️ Deleting user: \(userId)")

        try await db.collection("authorizedUsers")
            .document(userId)
            .delete()

        print("✅ User deleted successfully")
    }

    func updateUserPassword(userId: String, newPassword: String) async throws {
        print("🔑 Updating password for user: \(userId)")

        try await db.collection("authorizedUsers")
            .document(userId)
            .updateData(["password": newPassword])

        print("✅ Password updated successfully")
    }

    // MARK: - Transaction Management

    func addTransaction(
        userId: String,
        userName: String,
        amount: Double,
        description: String
    ) async throws {
        print("📝 Adding transaction: \(amount) THB for \(userName)")

        try await db.collection("transactions").addDocument(data: [
            "userId": userId,
            "userName": userName,
            "amount": amount,
            "description": description,
            "timestamp": Firestore.Timestamp(date: Date())
        ])

        print("✅ Transaction recorded")
    }

    func fetchTransactions(for userId: String) async throws -> [Transaction] {
        print("📜 Fetching transactions for user: \(userId)")

        let snapshot = try await db.collection("transactions")
            .whereField("userId", isEqualTo: userId)
            .order(by: "timestamp", descending: true)
            .limit(to: 50)
            .getDocuments()

        let transactions = snapshot.documents.map { doc in
            Transaction(id: doc.documentID, data: doc.data())
        }

        print("✅ Loaded \(transactions.count) transactions")
        return transactions
    }

    func fetchAllTransactions() async throws -> [Transaction] {
        print("📜 Fetching all transactions...")

        let snapshot = try await db.collection("transactions")
            .order(by: "timestamp", descending: true)
            .limit(to: 100)
            .getDocuments()

        let transactions = snapshot.documents.map { doc in
            Transaction(id: doc.documentID, data: doc.data())
        }

        print("✅ Loaded \(transactions.count) transactions")
        return transactions
    }

    // MARK: - Helper Methods

    func topUpBalance(
        userId: String,
        userName: String,
        amount: Double,
        description: String
    ) async throws {
        guard let user = users.first(where: { $0.id == userId }) else {
            throw NSError(domain: "FirebaseManager", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "User not found"
            ])
        }

        let newBalance = user.balance + amount

        // Update balance
        try await updateBalance(userId: userId, newBalance: newBalance)

        // Record transaction
        try await addTransaction(
            userId: userId,
            userName: userName,
            amount: amount,
            description: description
        )

        print("✅ Top-up completed: \(userName) now has \(newBalance) THB")
    }

    func deductBalance(
        userId: String,
        userName: String,
        amount: Double,
        description: String
    ) async throws {
        guard let user = users.first(where: { $0.id == userId }) else {
            throw NSError(domain: "FirebaseManager", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "User not found"
            ])
        }

        let newBalance = user.balance - amount

        // Update balance
        try await updateBalance(userId: userId, newBalance: newBalance)

        // Record transaction (negative amount)
        try await addTransaction(
            userId: userId,
            userName: userName,
            amount: -amount,
            description: description
        )

        print("✅ Deduction completed: \(userName) now has \(newBalance) THB")
    }
}
