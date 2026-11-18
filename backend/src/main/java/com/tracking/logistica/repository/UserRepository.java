package com.tracking.logistica.repository;

import com.tracking.logistica.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);
    Optional<User> findByIdentification(String identification);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    boolean existsByEmail(String email);

    boolean existsByIdentification(String identification);

    List<User> findByAccountLockedTrue();

    List<User> findByEmailVerifiedFalseAndCreatedAtBefore(LocalDateTime before);

    @Query("select u from User u where u.accountLocked = true or u.penaltyUntil > :now order by u.fullName")
    List<User> findUnderSecurityPenalty(@Param("now") LocalDateTime now);

    @Query("select u from User u where u.identification in "
            + "(select s.recipientIdentification from Shipment s) order by u.fullName")
    List<User> findUsersWithShipments();
}
