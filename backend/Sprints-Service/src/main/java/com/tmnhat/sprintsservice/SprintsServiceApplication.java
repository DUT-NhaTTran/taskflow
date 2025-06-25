package com.tmnhat.sprintsservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.tmnhat.sprintsservice", "com.tmnhat.common"})
public class SprintsServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(SprintsServiceApplication.class, args);
    }

}
