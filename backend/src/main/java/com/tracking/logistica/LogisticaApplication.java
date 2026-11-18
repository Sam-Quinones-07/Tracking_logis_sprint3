package com.tracking.logistica;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** {@code @EnableScheduling}: limpieza de sesiones viejas y de cuentas sin verificar (HU-S-22, HU-S-23). */
@SpringBootApplication
@EnableScheduling
public class LogisticaApplication {

	public static void main(String[] args) {
		SpringApplication.run(LogisticaApplication.class, args);
	}

}
