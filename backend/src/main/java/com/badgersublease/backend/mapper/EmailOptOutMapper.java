package com.badgersublease.backend.mapper;

import org.apache.ibatis.annotations.*;

@Mapper
public interface EmailOptOutMapper {

    @Select("SELECT EXISTS(SELECT 1 FROM EmailOptOuts WHERE Email = #{email})")
    boolean isOptedOut(@Param("email") String email);

    @Insert("INSERT INTO EmailOptOuts (Email) VALUES (#{email}) ON CONFLICT (Email) DO NOTHING")
    void insertOptOut(@Param("email") String email);
}
