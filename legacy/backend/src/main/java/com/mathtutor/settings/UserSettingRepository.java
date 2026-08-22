package com.mathtutor.settings;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserSettingRepository extends JpaRepository<UserSetting, UUID> {
    Optional<UserSetting> findByOwnerTypeAndOwnerIdAndKey(String ownerType, UUID ownerId, String key);
}
