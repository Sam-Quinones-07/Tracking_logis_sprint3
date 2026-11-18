package com.tracking.logistica.dto;

import com.tracking.logistica.entity.Role;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {

    private String token;
    private String email;
    private String fullName;
    private Role role;
    /** HU-S-22: segundos de inactividad tras los que el servidor cierra la sesión. */
    private long sessionTimeoutSeconds;
}