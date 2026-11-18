package com.tracking.logistica.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "El correo electrónico es obligatorio")
    @Email(message = "El formato del correo electrónico no es válido")
    private String email;

    @NotBlank(message = "El nombre completo es obligatorio")
    private String fullName;

    @NotBlank(message = "La identificación es obligatoria")
    @Pattern(regexp = "[0-9]{1,10}", message = "La identificación debe contener solo números y máximo 10 dígitos")
    private String identification;

    @NotBlank(message = "La contraseña es obligatoria")
    @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
    private String password;

    @NotBlank(message = "La dirección es obligatoria")
    @Size(max = 200, message = "La dirección no puede superar 200 caracteres")
    private String address;

    @NotBlank(message = "La ciudad y país son obligatorios")
    @Size(max = 100, message = "La ciudad y país no pueden superar 100 caracteres")
    private String cityCountry;
}
