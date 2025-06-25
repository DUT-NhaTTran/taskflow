package com.tmnhat.userservice.config;

import com.cloudinary.Cloudinary;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class CloudinaryConfig {

    @Bean
    public Cloudinary cloudinary() {
        Map<String, String> config = new HashMap<>();
        config.put("cloud_name", "dwmospuhh");
        config.put("api_key", "868699197389694");
        config.put("api_secret", "A2ClBOd7uTSXZkIOFvEizHhZCpQ");
        return new Cloudinary(config);
    }
}
