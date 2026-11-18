package com.tracking.logistica.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** HU-06: solo dirección y ciudad-país son editables. */
@Getter
@Setter
public class ProfileUpdateRequest {
    @NotBlank(message = "La dirección es obligatoria")
    @Size(max = 200, message = "La dirección no puede superar 200 caracteres")
    private String address;

    @NotBlank(message = "La ciudad y el país son obligatorios")
    @Size(max = 100, message = "La ciudad y el país no pueden superar 100 caracteres")
    private String cityCountry;
}
