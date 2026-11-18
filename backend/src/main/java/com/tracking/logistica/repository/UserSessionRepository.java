package com.tracking.logistica.repository;

import com.tracking.logistica.entity.SessionEndReason;
import com.tracking.logistica.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface UserSessionRepository extends JpaRepository<UserSession, String> {

    @Query("select s from UserSession s join fetch s.user where s.id = :id")
    Optional<UserSession> findWithUser(@Param("id") String id);

    @Modifying
    @Query("update UserSession s set s.revokedAt = :now, s.revokeReason = :reason "
            + "where s.user.id = :userId and s.revokedAt is null")
    int revokeAllForUser(@Param("userId") Long userId, @Param("reason") SessionEndReason reason, @Param("now") LocalDateTime now);

    @Modifying
    @Query("delete from UserSession s where s.lastActivityAt < :before")
    int deleteInactiveBefore(@Param("before") LocalDateTime before);

    @Modifying
    @Query("delete from UserSession s where s.user.id = :userId")
    int deleteAllForUser(@Param("userId") Long userId);
}
