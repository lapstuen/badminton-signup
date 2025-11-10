//
//  ContentView.swift
//  BadmintonWalletManager
//
//  Created by Claude Code on 2025-11-10.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var firebase = FirebaseManager()
    @State private var searchText = ""
    @State private var showingAllTransactions = false

    var filteredUsers: [User] {
        let sorted = firebase.users.sorted { $0.name < $1.name }

        if searchText.isEmpty {
            return sorted
        }

        return sorted.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    var totalBalance: Double {
        firebase.users.reduce(0) { $0 + $1.balance }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Summary Header
                summaryHeader

                // User List
                if firebase.isLoading {
                    ProgressView("Loading users...")
                        .frame(maxHeight: .infinity)
                } else if firebase.users.isEmpty {
                    emptyState
                } else {
                    userList
                }
            }
            .navigationTitle("💰 Wallet Manager")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAllTransactions = true
                    } label: {
                        Image(systemName: "list.bullet.rectangle")
                    }
                }
            }
            .sheet(isPresented: $showingAllTransactions) {
                AllTransactionsView(firebase: firebase)
            }
            .searchable(text: $searchText, prompt: "Search users...")
        }
    }

    // MARK: - Summary Header

    private var summaryHeader: some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Total Users")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(firebase.users.count)")
                        .font(.title2)
                        .bold()
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("Total Balance")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(Int(totalBalance)) THB")
                        .font(.title2)
                        .bold()
                        .foregroundColor(.green)
                }
            }
            .padding()
            .background(Color(.systemGray6))
        }
    }

    // MARK: - User List

    private var userList: some View {
        List {
            ForEach(filteredUsers) { user in
                NavigationLink {
                    UserDetailView(user: user, firebase: firebase)
                } label: {
                    UserRowView(user: user)
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.3.fill")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("No Users Yet")
                .font(.title2)
                .bold()

            Text("Users will appear here once they're added to Firebase")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxHeight: .infinity)
    }
}

// MARK: - User Row View

struct UserRowView: View {
    let user: User

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(balanceGradient)
                .frame(width: 50, height: 50)
                .overlay {
                    Text(user.name.prefix(1).uppercased())
                        .font(.title3)
                        .bold()
                        .foregroundColor(.white)
                }

            // User Info
            VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                    .font(.headline)

                Text("\(Int(user.balance)) THB")
                    .font(.subheadline)
                    .foregroundColor(balanceColor)
                    .bold()
            }

            Spacer()

            // Balance Indicator
            Image(systemName: balanceIcon)
                .foregroundColor(balanceColor)
                .font(.title3)
        }
        .padding(.vertical, 8)
    }

    private var balanceGradient: LinearGradient {
        switch user.balanceColor {
        case .low:
            return LinearGradient(colors: [.red, .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .medium:
            return LinearGradient(colors: [.orange, .yellow], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .high:
            return LinearGradient(colors: [.green, .mint], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
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
}

#Preview {
    ContentView()
}
