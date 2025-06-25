package com.tmnhat.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**") // 👈 cho tất cả API
                        .allowedOriginPatterns("*") // Use allowedOriginPatterns instead of allowedOrigins
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS") // các method cho phép
                        .allowedHeaders("*") // cho phép tất cả header
                        .allowCredentials(false); // Set to false to avoid CORS error with "*"
            }
        };
    }
} 