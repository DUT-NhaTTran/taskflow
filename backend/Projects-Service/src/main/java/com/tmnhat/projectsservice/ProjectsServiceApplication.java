package com.tmnhat.projectsservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.tmnhat.projectsservice", "com.tmnhat.common"})
public class ProjectsServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProjectsServiceApplication.class, args);
    }

}
