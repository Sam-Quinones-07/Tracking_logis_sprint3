package com.tracking.logistica.controller;

import com.tracking.logistica.dto.AccountSecurityResponse;
import com.tracking.logistica.dto.SecurityEventResponse;
import com.tracking.logistica.dto.UserResponse;
import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.service.SecurityAuditService;
import com.tracking.logistica.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final SecurityAuditService securityAuditService;

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.findAllUsers());
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<UserResponse> updateRole(@PathVariable Long userId, @RequestParam String role,
                                                   Authentication authentication) {
        return ResponseEntity.ok(userService.updateRole(userId, role, authentication.getName()));
    }

    @PutMapping("/users/{userId}/unlock")
    public ResponseEntity<UserResponse> unlock(@PathVariable Long userId, Authentication authentication) {
        return ResponseEntity.ok(userService.unlockAccount(userId, authentication.getName()));
    }

    @GetMapping("/users/locked")
    public ResponseEntity<List<UserResponse>> getLockedUsers() {
        return ResponseEntity.ok(userService.findLockedUsers());
    }

    @GetMapping("/users/security-status")
    public ResponseEntity<List<AccountSecurityResponse>> getAccountsUnderSecurityPenalty() {
        return ResponseEntity.ok(userService.findAccountsUnderSecurityPenalty());
    }

    /** Registro de seguridad: penalizaciones, bloqueos, desbloqueos, consultas denegadas y cambios de rol. */
    @GetMapping("/security-events")
    public ResponseEntity<List<SecurityEventResponse>> securityEvents(@RequestParam(required = false) SecurityEventType type) {
        return ResponseEntity.ok(securityAuditService.recent(type));
    }
}
