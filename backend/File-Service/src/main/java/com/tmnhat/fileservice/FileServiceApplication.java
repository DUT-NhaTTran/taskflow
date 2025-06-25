package com.tmnhat.fileservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

import java.io.File;

@SpringBootApplication
@ComponentScan(basePackages = {"com.tmnhat.fileservice", "com.tmnhat.common"})
public class FileServiceApplication {

    public static void main(String[] args) {
        // Create upload directory if it doesn't exist
        new File("uploads").mkdirs();
        
        SpringApplication.run(FileServiceApplication.class, args);
    }
} 