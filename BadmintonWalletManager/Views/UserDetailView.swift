//
//  UserDetailView.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import SwiftUI

struct UserDetailView: View {
    let user: User
    @ObservedObject var firebase: FirebaseManager

    @State private var amount = ""
    @State private var description = ""
    @State private var isProcessing = false
    @State private var showSuccess = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showTransactions = false
    @State private var transactions: [Transaction] = []
    @State private var isLoadingTransactions = false

    @Environment(\.dismiss) var dismiss

    var body: some View {
        Form {
            // Current Balance Section
            balanceSection

            // Quick Actions
            quickActionsSection

            // Top-up Section
            topUpSection

            // Deduct Section
            deductSection

            // Transaction History
            transactionHistorySection

            // Danger Zone
            dangerZoneSection
        }
        .navigationTitle(user.name)
        .navigationBarTitleDisplayMode(.large)
        .alert("Success!", isPresented: $showSuccess) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Transaction completed successfully!")
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
        .sheet(isPresented: $showTransactions) {
            TransactionHistoryView(
                transactions: transactions,
                userName: user.name,
                isLoading: isLoadingTransactions
            )
        }
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        Section {
            VStack(spacing: 12) {
                Text("Current Balance")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text("\(Int(user.balance)) THB")
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(balanceColor)

                balanceIndicator
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical)
        }
    }

    private var balanceIndicator: some View {
        HStack(spacing: 8) {
            Image(systemName: balanceIcon)
            Text(balanceText)
                .font(.subheadline)
        }
        .foregroundColor(balanceColor)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(balanceColor.opacity(0.1))
        .cornerRadius(20)
    }

    // MARK: - Quick Actions

    private var quickActionsSection: some View {
        Section("Quick Top-ups") {
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                quickTopUpButton(150)
                quickTopUpButton(300)
                quickTopUpButton(450)
                quickTopUpButton(600)
            }
            .padding(.vertical, 8)
        }
    }

    private func quickTopUpButton(_ value: Int) -> some View {
        Button {
            amount = "\(value)"
            description = "Top-up \(value) THB"
        } label: {
            VStack(spacing: 4) {
                Text("\(value)")
                    .font(.headline)
                Text("THB")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.green.opacity(0.1))
            .foregroundColor(.green)
            .cornerRadius(10)
        }
    }

    // MARK: - Top-up Section

    private var topUpSection: some View {
        Section("Add to Balance") {
            TextField("Amount (THB)", text: $amount)
                .keyboardType(.numberPad)

            TextField("Description", text: $description)

            Button {
                Task {
                    await performTopUp()
                }
            } label: {
                HStack {
                    if isProcessing {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "plus.circle.fill")
                        Text("Add to Balance")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(canSubmit ? Color.green : Color.gray)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .disabled(!canSubmit || isProcessing)
            .listRowInsets(EdgeInsets())
            .buttonStyle(.plain)
        }
    }

    // MARK: - Deduct Section

    private var deductSection: some View {
        Section("Deduct from Balance") {
            Button {
                Task {
                    await performDeduction()
                }
            } label: {
                HStack {
                    if isProcessing {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "minus.circle.fill")
                        Text("Deduct from Balance")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(canSubmit ? Color.orange : Color.gray)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .disabled(!canSubmit || isProcessing)
            .listRowInsets(EdgeInsets())
            .buttonStyle(.plain)
        }
    }

    // MARK: - Transaction History

    private var transactionHistorySection: some View {
        Section {
            Button {
                Task {
                    await loadTransactions()
                }
            } label: {
                HStack {
                    Image(systemName: "list.bullet.rectangle")
                    Text("View Transaction History")
                    Spacer()
                    if isLoadingTransactions {
                        ProgressView()
                    } else {
                        Image(systemName: "chevron.right")
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }

    // MARK: - Danger Zone

    private var dangerZoneSection: some View {
        Section("Danger Zone") {
            NavigationLink {
                EditUserView(user: user, firebase: firebase)
            } label: {
                Label("Edit User Details", systemImage: "pencil")
            }
        }
    }

    // MARK: - Actions

    private func performTopUp() async {
        guard let amountValue = Double(amount) else { return }

        isProcessing = true

        do {
            try await firebase.topUpBalance(
                userId: user.id,
                userName: user.name,
                amount: amountValue,
                description: description.isEmpty ? "Top-up" : description
            )

            await MainActor.run {
                isProcessing = false
                showSuccess = true
                amount = ""
                self.description = ""
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }

    private func performDeduction() async {
        guard let amountValue = Double(amount) else { return }

        isProcessing = true

        do {
            try await firebase.deductBalance(
                userId: user.id,
                userName: user.name,
                amount: amountValue,
                description: description.isEmpty ? "Deduction" : description
            )

            await MainActor.run {
                isProcessing = false
                showSuccess = true
                amount = ""
                self.description = ""
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }

    private func loadTransactions() async {
        isLoadingTransactions = true

        do {
            let fetchedTransactions = try await firebase.fetchTransactions(for: user.id)
            await MainActor.run {
                self.transactions = fetchedTransactions
                isLoadingTransactions = false
                showTransactions = true
            }
        } catch {
            await MainActor.run {
                isLoadingTransactions = false
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }

    // MARK: - Computed Properties

    private var canSubmit: Bool {
        guard let amountValue = Double(amount) else { return false }
        return amountValue > 0
    }

    private var balanceColor: Color {
        switch user.balanceColor {
        case .low: return .red
        case .medium: return .orange
        case .high: return .green
        }
    }

    private var balanceIcon: String {
        switch user.balanceColor {
        case .low: return "exclamationmark.triangle.fill"
        case .medium: return "exclamationmark.circle.fill"
        case .high: return "checkmark.circle.fill"
        }
    }

    private var balanceText: String {
        switch user.balanceColor {
        case .low: return "Low Balance"
        case .medium: return "Medium Balance"
        case .high: return "Healthy Balance"
        }
    }
}

// MARK: - Edit User View

struct EditUserView: View {
    let user: User
    @ObservedObject var firebase: FirebaseManager

    @State private var newPassword = ""
    @State private var isProcessing = false
    @State private var showDeleteConfirmation = false

    @Environment(\.dismiss) var dismiss

    var body: some View {
        Form {
            Section("Current Password") {
                HStack {
                    Text("Password:")
                    Spacer()
                    Text(user.password)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                }
            }

            Section("Change Password") {
                TextField("New Password", text: $newPassword)

                Button("Update Password") {
                    Task {
                        await updatePassword()
                    }
                }
                .disabled(newPassword.isEmpty || isProcessing)
            }

            Section {
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    HStack {
                        if isProcessing {
                            ProgressView()
                        } else {
                            Image(systemName: "trash")
                            Text("Delete User")
                        }
                    }
                }
                .disabled(isProcessing)
            }
        }
        .navigationTitle("Edit User")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Delete User?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task {
                    await deleteUser()
                }
            }
        } message: {
            Text("Are you sure you want to delete \(user.name)? This action cannot be undone.")
        }
    }

    private func updatePassword() async {
        isProcessing = true

        do {
            try await firebase.updateUserPassword(userId: user.id, newPassword: newPassword)
            await MainActor.run {
                isProcessing = false
                dismiss()
            }
        } catch {
            await MainActor.run {
                isProcessing = false
            }
            print("Error updating password: \(error)")
        }
    }

    private func deleteUser() async {
        isProcessing = true

        do {
            try await firebase.deleteUser(userId: user.id)
            await MainActor.run {
                isProcessing = false
                dismiss()
            }
        } catch {
            await MainActor.run {
                isProcessing = false
            }
            print("Error deleting user: \(error)")
        }
    }
}

#Preview {
    NavigationStack {
        UserDetailView(
            user: User(
                id: "1",
                name: "Geir",
                balance: 600,
                password: "12345"
            ),
            firebase: FirebaseManager()
        )
    }
}
