package com.tracker.dto;

public class AuthResponse {
    private boolean authenticated = true;
    private String token;
    private String username;
    private String displayName;

    public AuthResponse(String token, String username, String displayName) {
        this.authenticated = true;
        this.token = token;
        this.username = username;
        this.displayName = displayName;
    }

    public boolean isAuthenticated() { return authenticated; }
    public String getToken() { return token; }
    public String getUsername() { return username; }
    public String getDisplayName() { return displayName; }
}
