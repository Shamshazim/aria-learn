package com.mathtutor.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/** Small key/value settings store. Defaults are returned when a setting is unset. */
@Service
public class SettingsService {

    public static final String PARENT = "PARENT";
    public static final String KEY_AUTO_ASSIGN_HOMEWORK = "auto_assign_homework";

    private final UserSettingRepository repository;

    public SettingsService(UserSettingRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public boolean getBool(String ownerType, UUID ownerId, String key, boolean defaultValue) {
        return repository.findByOwnerTypeAndOwnerIdAndKey(ownerType, ownerId, key)
                .map(s -> Boolean.parseBoolean(s.getValue()))
                .orElse(defaultValue);
    }

    @Transactional
    public void setBool(String ownerType, UUID ownerId, String key, boolean value) {
        UserSetting setting = repository.findByOwnerTypeAndOwnerIdAndKey(ownerType, ownerId, key)
                .orElseGet(() -> {
                    UserSetting s = new UserSetting();
                    s.setOwnerType(ownerType);
                    s.setOwnerId(ownerId);
                    s.setKey(key);
                    return s;
                });
        setting.setValue(Boolean.toString(value));
        setting.setUpdatedAt(Instant.now());
        repository.save(setting);
    }
}
