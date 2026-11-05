package com.badgersublease.backend.mapper;

import com.badgersublease.backend.model.Report;
import com.badgersublease.backend.model.User;

import org.apache.ibatis.annotations.*;
import org.apache.ibatis.annotations.Param;

// if running into performance issues, we can switch to XML based mybatis, however this is more
// readable IMO
@Mapper
public interface UserMapper {

        @Select("SELECT userid, firebase_uid, is_verified from Users where userid = #{userId};")
        @Results({
                @Result(property = "userID", column = "userid"),
                @Result(property = "firebaseUid", column = "firebase_uid"),
                @Result(property = "isVerified", column = "is_verified")
        })
        User getUserById(Long userId);

        @Select("SELECT userid, firebase_uid, is_verified from Users where firebase_uid = #{firebaseUid};")
        @Results({
                @Result(property = "userID", column = "userid"),
                @Result(property = "firebaseUid", column = "firebase_uid"),
                @Result(property = "isVerified", column = "is_verified")
        })
        User getUserByFirebaseUid(String firebaseUid);

        @Insert("INSERT INTO Users (firebase_uid, is_verified) VALUES (#{firebaseUid}, #{isVerified}) ON CONFLICT (firebase_uid) DO NOTHING")
        void createUser(User user);

        @Update("UPDATE Users SET is_verified = #{isVerified} WHERE firebase_uid = #{firebaseUid}")
        void updateUserVerification(@Param("firebaseUid") String firebaseUid, @Param("isVerified") boolean isVerified);

        @Delete(" delete from Users where userid = #{userId};")
        void deleteUserById(Long userId);

        @Select("SELECT userid, firebase_uid, is_verified from Users")
        @Results({
                @Result(property = "userID", column = "userid"),
                @Result(property = "firebaseUid", column = "firebase_uid"),
                @Result(property = "isVerified", column = "is_verified")
        })
        java.util.List<User> getAllUsers();

        // Reports
        @Insert("INSERT INTO Reports (UserId, ReportedUserID, ReportMessage, Reason) " +
                "VALUES (#{userId}, #{reportedUserId}, #{reportMessage}, #{reason})")
        void submitUserReport(Report report);
}
