package com.tracking.logistica.repository;

import com.tracking.logistica.entity.SecurityEvent;
import com.tracking.logistica.entity.SecurityEventType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SecurityEventRepository extends JpaRepository<SecurityEvent, Long> {
    List<SecurityEvent> findTop300ByOrderByCreatedAtDescIdDesc();
    List<SecurityEvent> findTop300ByTypeOrderByCreatedAtDescIdDesc(SecurityEventType type);
    long countByType(SecurityEventType type);
}
