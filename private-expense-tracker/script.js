const SHEET_ID = '1Al8Ub7mksSmmXRJ36nDbqRbF-86bGWzzZZGCuCk1QvE';
let accessToken = "";
let tokenClient;

document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connectBtn');
    const clientIdInput = document.getElementById('clientId');
    const authStatus = document.getElementById('authStatus');
    const appSection = document.getElementById('app-section');
    const expenseForm = document.getElementById('expenseForm');
    const refreshBtn = document.getElementById('refreshBtn');

    // Default today's date
    document.getElementById('expenseDate').valueAsDate = new Date();

    connectBtn.addEventListener('click', () => {
        const clientId = clientIdInput.value.trim();
        if (!clientId) {
            authStatus.textContent = "Please enter a valid Client ID.";
            authStatus.style.color = "red";
            return;
        }

        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        accessToken = tokenResponse.access_token;
                        authStatus.textContent = "Access granted. Ready to query the database.";
                        authStatus.style.color = "green";

                        // Show app section
                        document.getElementById('config-section').style.display = 'none';
                        appSection.style.display = 'block';

                        // Load data
                        await loadRecords();
                    } else {
                        authStatus.textContent = "Failed to obtain access token.";
                        authStatus.style.color = "red";
                    }
                },
            });
            tokenClient.requestAccessToken();
        } catch (e) {
            console.error("Error initializing token client", e);
            authStatus.textContent = "Error initializing Google Identity Service. Check Client ID.";
            authStatus.style.color = "red";
        }
    });

    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('expenseDate').value;
        const person = document.getElementById('expensePerson').value;
        const amount = document.getElementById('expenseAmount').value;
        const desc = document.getElementById('expenseDescription').value;

        const addBtn = document.getElementById('addBtn');
        const addStatus = document.getElementById('addStatus');

        addBtn.disabled = true;
        addStatus.textContent = "Adding record...";
        addStatus.className = "status-msg info";

        try {
            await addRecord([date, person, amount, desc]);
            addStatus.textContent = "Record added successfully!";
            addStatus.className = "status-msg success";

            // Clear form (except date)
            document.getElementById('expensePerson').value = '';
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expenseDescription').value = '';

            // Reload table
            await loadRecords();
        } catch (error) {
            console.error(error);
            addStatus.textContent = `Error: ${error.message}`;
            addStatus.className = "status-msg error";
        } finally {
            addBtn.disabled = false;
        }
    });

    refreshBtn.addEventListener('click', async () => {
        await loadRecords();
    });
});

async function getRecords() {
    const range = 'Sheet1!A2:D'; // Skip headers, read columns A through D
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to read sheet or unauthorized');
    }

    const data = await response.json();
    return data.values || [];
}

async function addRecord(newRowData) {
    const range = 'Sheet1!A:A';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: [newRowData]
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to append row');
    }
    console.log("Record added successfully");
}

async function loadRecords() {
    const tbody = document.getElementById('expensesBody');
    const loadingMsg = document.getElementById('loadingMsg');
    const emptyMsg = document.getElementById('emptyMsg');

    tbody.innerHTML = '';
    loadingMsg.style.display = 'block';
    emptyMsg.style.display = 'none';

    try {
        const records = await getRecords();
        loadingMsg.style.display = 'none';

        if (records.length === 0) {
            emptyMsg.style.display = 'block';
        } else {
            records.forEach(row => {
                const tr = document.createElement('tr');

                // Assuming format: Date, Person, Amount, Description
                for (let i = 0; i < 4; i++) {
                    const td = document.createElement('td');
                    // Format amount as currency if it's the 3rd column and is a number
                    if (i === 2 && !isNaN(parseFloat(row[i]))) {
                        td.textContent = '$' + parseFloat(row[i]).toFixed(2);
                    } else {
                        td.textContent = row[i] || '';
                    }
                    tr.appendChild(td);
                }

                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        loadingMsg.style.display = 'none';
        emptyMsg.style.display = 'block';
        emptyMsg.textContent = `Error loading records: ${error.message}`;
        emptyMsg.style.color = 'red';
        console.error("Error loading records:", error);
    }
}
