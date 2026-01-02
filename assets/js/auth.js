const AUTH_EXPIRE_MS = 1000 * 60 * 60 * 8; // 8 jam

const auth = {
    setSession(token, user) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("expires_at", Date.now() + AUTH_EXPIRE_MS);
    },

    logout() {
        localStorage.clear();
        window.location.href = "index.html";
    },

    isAuthenticated() {
        const token = localStorage.getItem("token");
        const expires = localStorage.getItem("expires_at");

        if (!token || !expires) return false;

        if (Date.now() > Number(expires)) {
            this.logout();
            return false;
        }

        return true;
    },

    getUser() {
        return JSON.parse(localStorage.getItem("user") || "null");
    },

    getToken() {
        return localStorage.getItem("token");
    },

    // 🔥 INI YANG HILANG
    getAuthHeader() {
        const token = localStorage.getItem("token");

        if (!token) return {};

        return {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json"
        };
    }
};
