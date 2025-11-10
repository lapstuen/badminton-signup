//
//  TransactionHistoryView.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import SwiftUI

struct TransactionHistoryView: View {
    let transactions: [Transaction]
    let userName: String
    let isLoading: Bool

    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading transactions...")
                } else if transactions.isEmpty {
                    emptyState
                } else {
                    transactionList
                }
            }
            .navigationTitle("\(userName) Transactions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var transactionList: some View {
        List(transactions) { transaction in
            TransactionRowView(transaction: transaction)
        }
        .listStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("No Transactions Yet")
                .font(.title2)
                .bold()

            Text("Transactions will appear here once they're recorded")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
}

struct TransactionRowView: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Circle()
                .fill(transaction.isDebit ? Color.red.opacity(0.2) : Color.green.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: transaction.isDebit ? "arrow.down" : "arrow.up")
                        .foregroundColor(transaction.isDebit ? .red : .green)
                        .font(.title3)
                }

            // Details
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.description)
                    .font(.headline)

                Text(transaction.formattedDate)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Amount
            Text(transaction.formattedAmount)
                .font(.headline)
                .foregroundColor(transaction.isDebit ? .red : .green)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - All Transactions View

struct AllTransactionsView: View {
    @ObservedObject var firebase: FirebaseManager

    @State private var transactions: [Transaction] = []
    @State private var isLoading = false
    @State private var searchText = ""

    @Environment(\.dismiss) var dismiss

    var filteredTransactions: [Transaction] {
        if searchText.isEmpty {
            return transactions
        }

        return transactions.filter {
            $0.userName.localizedCaseInsensitiveContains(searchText) ||
            $0.description.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading transactions...")
                } else if transactions.isEmpty {
                    emptyState
                } else {
                    transactionList
                }
            }
            .navigationTitle("All Transactions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search transactions...")
            .task {
                await loadTransactions()
            }
        }
    }

    private var transactionList: some View {
        List {
            ForEach(filteredTransactions) { transaction in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(transaction.userName)
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Spacer()

                        Text(transaction.formattedDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    HStack(spacing: 12) {
                        // Icon
                        Circle()
                            .fill(transaction.isDebit ? Color.red.opacity(0.2) : Color.green.opacity(0.2))
                            .frame(width: 44, height: 44)
                            .overlay {
                                Image(systemName: transaction.isDebit ? "arrow.down" : "arrow.up")
                                    .foregroundColor(transaction.isDebit ? .red : .green)
                                    .font(.title3)
                            }

                        // Details
                        VStack(alignment: .leading, spacing: 4) {
                            Text(transaction.description)
                                .font(.headline)
                        }

                        Spacer()

                        // Amount
                        Text(transaction.formattedAmount)
                            .font(.headline)
                            .foregroundColor(transaction.isDebit ? .red : .green)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .listStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("No Transactions Yet")
                .font(.title2)
                .bold()

            Text("Transactions will appear here once they're recorded")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }

    private func loadTransactions() async {
        isLoading = true

        do {
            let fetchedTransactions = try await firebase.fetchAllTransactions()
            await MainActor.run {
                self.transactions = fetchedTransactions
                isLoading = false
            }
        } catch {
            await MainActor.run {
                isLoading = false
            }
            print("Error loading transactions: \(error)")
        }
    }
}

#Preview {
    TransactionHistoryView(
        transactions: [
            Transaction(
                id: "1",
                userId: "user1",
                userName: "Geir",
                amount: 300,
                description: "Top-up",
                timestamp: Date()
            ),
            Transaction(
                id: "2",
                userId: "user1",
                userName: "Geir",
                amount: -150,
                description: "Session payment",
                timestamp: Date().addingTimeInterval(-86400)
            )
        ],
        userName: "Geir",
        isLoading: false
    )
}
