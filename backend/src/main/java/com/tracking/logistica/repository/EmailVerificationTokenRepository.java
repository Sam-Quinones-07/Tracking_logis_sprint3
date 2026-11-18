package com.tracking.logistica.repository;

import com.tracking.logistica.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    @Query("select t from EmailVerificationToken t join fetch t.user where t.tokenHash = :hash")
    Optional<EmailVerificationToken> findByHashWithUser(@Param("hash") String hash);

    @Modifying
    @Query("update EmailVerificationToken t set t.invalidatedAt = :now "
            + "where t.user.id = :userId and t.usedAt is null and t.invalidatedAt is null")
    int invalidateActive(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /** Marca el código como usado solo si sigue vigente: devuelve 0 si otra petición lo usó primero. */
    @Modifying
    @Query("update EmailVerificationToken t set t.usedAt = :now "
            + "where t.id = :id and t.usedAt is null and t.invalidatedAt is null")
    int markUsed(@Param("id") Long id, @Param("now") LocalDateTime now);

    long countByUserIdAndResendTrueAndCreatedAtAfter(Long userId, LocalDateTime after);

    @Modifying
    @Query("delete from EmailVerificationToken t where t.user.id = :userId")
    int deleteAllForUser(@Param("userId") Long userId);
}
