package com.tracking.logistica;

import com.jayway.jsonpath.JsonPath;
import com.tracking.logistica.entity.Role;
import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.repository.SecurityEventRepository;
import com.tracking.logistica.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Pruebas de extremo a extremo de las historias del sprint 3 sobre H2 con los datos de ejemplo. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class Sprint3IntegrationTest {

    private static final String DEMO_PASSWORD = "Demo1234!";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired SecurityEventRepository securityEvents;

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private String register(String email, String id, String extra) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"fullName\":\"Prueba\",\"identification\":\"" + id
                                + "\",\"password\":\"segura1234\",\"address\":\"Calle 1\",\"cityCountry\":\"Medellín, Colombia\"" + extra + "}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingVerification").value(true))
                .andReturn().getResponse().getContentAsString();
        String link = JsonPath.read(body, "$.devVerificationLink");
        return link.substring(link.indexOf("verificar=") + "verificar=".length());
    }

    // ---------------------------------------------------------------- HU-S-23 + HU-S-21 (registro)

    @Test
    void registroQuedaPendienteHastaVerificarYElEnlaceSirveUnaSolaVez() throws Exception {
        String token = register("nuevo@test.com", "7000000001", ",\"role\":\"ADMINISTRADOR\"");

        // HU-S-21: el rol enviado en la petición se ignora.
        assertThat(users.findByEmail("nuevo@test.com").orElseThrow().getRole()).isEqualTo(Role.CLIENTE);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nuevo@test.com\",\"password\":\"segura1234\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));

        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("VERIFICADO"));
        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.outcome").value("USADO"));

        login("nuevo@test.com", "segura1234");
    }

    @Test
    void reenviarInvalidaElEnlaceAnteriorYTieneLimitePorHora() throws Exception {
        String first = register("reenvio@test.com", "7000000002", "");
        String json = "{\"email\":\"reenvio@test.com\"}";
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/auth/resend-verification").contentType(MediaType.APPLICATION_JSON).content(json))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/auth/resend-verification").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isTooManyRequests());

        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + first + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.outcome").value("REEMPLAZADO"));
    }

    // ---------------------------------------------------------------- HU-S-22

    @Test
    void cerrarSesionInvalidaElTokenEnElServidor() throws Exception {
        String token = login("cliente@demo.com", DEMO_PASSWORD);
        mvc.perform(get("/api/profile").header("Authorization", bearer(token))).andExpect(status().isOk());

        mvc.perform(post("/api/auth/logout").header("Authorization", bearer(token))).andExpect(status().isNoContent());

        mvc.perform(get("/api/profile").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("CERRADA"));
    }

    // ---------------------------------------------------------------- HU-S-21

    @Test
    void cambioDeRolQuedaRegistradoEInvalidaLasSesionesDeLaCuenta() throws Exception {
        String admin = login("admin@tracking.com", "admin1234");
        register("rol@test.com", "7000000003", "");
        var user = users.findByEmail("rol@test.com").orElseThrow();
        user.setEmailVerified(true);
        users.save(user);
        String userToken = login("rol@test.com", "segura1234");

        mvc.perform(put("/api/admin/users/" + user.getId() + "/role").param("role", "OPERADOR_LOGISTICO")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("OPERADOR_LOGISTICO"));

        mvc.perform(get("/api/profile").header("Authorization", bearer(userToken)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("ROL_CAMBIADO"));

        var logged = securityEvents.findTop300ByTypeOrderByCreatedAtDescIdDesc(SecurityEventType.ROL_CAMBIADO);
        assertThat(logged).anySatisfy(e -> {
            assertThat(e.getActorEmail()).isEqualTo("admin@tracking.com");
            assertThat(e.getTargetEmail()).isEqualTo("rol@test.com");
            assertThat(e.getDetail()).contains("CLIENTE").contains("OPERADOR_LOGISTICO");
        });
    }

    @Test
    void noAdministradorQueIntentaCambiarUnRolEsRechazadoYRegistrado() throws Exception {
        String operator = login("operador@demo.com", DEMO_PASSWORD);
        long before = securityEvents.countByType(SecurityEventType.ROL_RECHAZADO);

        mvc.perform(put("/api/admin/users/1/role").param("role", "SUPERVISOR_LOGISTICO")
                        .header("Authorization", bearer(operator)))
                .andExpect(status().isForbidden());

        assertThat(securityEvents.countByType(SecurityEventType.ROL_RECHAZADO)).isEqualTo(before + 1);
    }

    // ---------------------------------------------------------------- HU-06

    @Test
    void perfilRechazaDireccionDeMasDe200Caracteres() throws Exception {
        String token = login("cliente2@demo.com", DEMO_PASSWORD);
        String longAddress = "a".repeat(201);
        mvc.perform(put("/api/profile").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"address\":\"" + longAddress + "\",\"cityCountry\":\"Bogotá, Colombia\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.address").exists());
    }

    // ---------------------------------------------------------------- HU-14, HU-15, HU-16

    @Test
    void reportesDelSupervisorUsanLosDatosDeEjemplo() throws Exception {
        String token = login("supervisor@demo.com", DEMO_PASSWORD);

        mvc.perform(get("/api/supervisor/transit-times").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(4))
                .andExpect(jsonPath("$.minHours").value(30.0))
                .andExpect(jsonPath("$.maxHours").value(80.0));

        mvc.perform(get("/api/supervisor/delays").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));

        mvc.perform(get("/api/supervisor/volume/summary").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.byStatus.CANCELADO").value(1));
    }

    @Test
    void clienteNoPuedeVerReportesDelSupervisor() throws Exception {
        String token = login("cliente@demo.com", DEMO_PASSWORD);
        mvc.perform(get("/api/supervisor/delays").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------- HU-18

    @Test
    void contactoDeWhatsappSoloParaClientes() throws Exception {
        mvc.perform(get("/api/contact").header("Authorization", bearer(login("cliente@demo.com", DEMO_PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.whatsappAvailable").value(true));
        mvc.perform(get("/api/contact").header("Authorization", bearer(login("operador@demo.com", DEMO_PASSWORD))))
                .andExpect(status().isForbidden());
    }
}
