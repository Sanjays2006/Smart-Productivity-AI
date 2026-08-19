package com.tracker.controller;

import com.tracker.dto.AuthRequest;
import com.tracker.dto.AuthResponse;
import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.security.JwtUtils;
import com.tracker.service.ActivityTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final ActivityTrackingService trackingService;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtUtils jwtUtils,
                          ActivityTrackingService trackingService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtils = jwtUtils;
        this.trackingService = trackingService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest authRequest) {
        if (authRequest == null || authRequest.getUsername() == null || authRequest.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        String username = authRequest.getUsername().trim();
        String email = authRequest.getEmail() != null ? authRequest.getEmail().trim() : "";
        String password = authRequest.getPassword();

        if (username.length() < 3)
            return ResponseEntity.badRequest().body(Map.of("error", "Username must be at least 3 characters"));
        if (password.length() < 6)
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
        if (userRepository.existsByUsername(username))
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
        if (!email.isEmpty() && userRepository.existsByEmail(email))
            return ResponseEntity.badRequest().body(Map.of("error", "Email address already registered"));

        User user = new User(username, email.isEmpty() ? username + "@local" : email, passwordEncoder.encode(password));
        userRepository.save(user);
        trackingService.track(user.getId(), "AUTH", "REGISTER", "User registered successfully: " + user.getUsername(), user.getUsername(), user.getId().toString());

        return login(authRequest);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest authRequest) {
        if (authRequest == null || authRequest.getUsername() == null || authRequest.getPassword() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Username/email and password are required"));
        }

        String identifier = authRequest.getUsername().trim();
        String password = authRequest.getPassword();

        if (identifier.isEmpty() || password.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Username/email and password are required"));
        }

        try {
            // Check if user exists by username or email
            Optional<User> existingUser = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier));

            String targetUsername = identifier;

            if (existingUser.isEmpty()) {
                if (userRepository.count() == 0) {
                    // Auto-seed initial account for first system setup
                    String email = identifier.contains("@") ? identifier : identifier + "@local";
                    String baseUsername = identifier.contains("@") ? identifier.split("@")[0] : identifier;
                    if (baseUsername.length() < 3) baseUsername = "user_" + baseUsername;
                    User newUser = new User(baseUsername, email, passwordEncoder.encode(password));
                    userRepository.save(newUser);
                    targetUsername = newUser.getUsername();
                    existingUser = Optional.of(newUser);
                } else {
                    return ResponseEntity.status(401).body(Map.of("error", "Account not found. Please click 'Create account' to sign up."));
                }
            } else {
                targetUsername = existingUser.get().getUsername();
            }

            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(targetUsername, password)
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String token = jwtUtils.generateToken(userDetails);
            
            User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);
            trackingService.track(user.getId(), "AUTH", "LOGIN", "User logged in successfully: " + user.getUsername(), user.getUsername(), user.getId().toString());
            
            return ResponseEntity.ok(new AuthResponse(token, user.getUsername(), user.getDisplayName()));
        } catch (org.springframework.security.core.AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials. Please check your username/email and password."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Login failed: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            userRepository.findByUsername(auth.getName()).ifPresent(u -> {
                trackingService.track(u.getId(), "AUTH", "LOGOUT", "User logged out: " + u.getUsername(), u.getUsername(), u.getId().toString());
            });
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName().equals("anonymousUser")) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
        return userRepository.findByUsername(auth.getName())
            .map(u -> ResponseEntity.ok(Map.of(
                "authenticated", true,
                "id", u.getId(),
                "username", u.getUsername(),
                "displayName", u.getDisplayName() != null ? u.getDisplayName() : u.getUsername(),
                "email", u.getEmail(),
                "role", u.getRole() != null ? u.getRole() : "USER",
                "onboarded", u.isOnboarded(),
                "createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString().substring(0, 10) : ""
            )))
            .orElse(ResponseEntity.status(401).body(Map.of("authenticated", false)));
    }
}
