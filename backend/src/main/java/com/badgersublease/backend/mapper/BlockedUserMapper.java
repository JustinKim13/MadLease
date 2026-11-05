package com.badgersublease.backend.mapper;

  import com.badgersublease.backend.model.BlockedUser;
  import org.apache.ibatis.annotations.*;
  import java.util.List;                                                                                             
   
  @Mapper                                                                                                            
  public interface BlockedUserMapper {
                                                                                                                     
      @Insert("INSERT INTO BlockedUsers (BlockerID, BlockedID) " +                                                   
              "VALUES (#{blockerId}, #{blockedId}) " +                                                               
              "ON CONFLICT (BlockerID, BlockedID) DO NOTHING")                                                       
      void blockUser(@Param("blockerId") Long blockerId,                                                             
                     @Param("blockedId") Long blockedId);                                                            
                                                                                                                     
      @Delete("DELETE FROM BlockedUsers " +                                                                          
              "WHERE BlockerID = #{blockerId} AND BlockedID = #{blockedId}")
      void unblockUser(@Param("blockerId") Long blockerId,                                                           
                       @Param("blockedId") Long blockedId);
                                                                                                                     
      @Select("SELECT BlockedUserID as blockedUserID, " +                                                            
              "BlockerID as blockerID, " +                                                                           
              "BlockedID as blockedID, " +                                                                           
              "CreatedAt as createdAt " +
              "FROM BlockedUsers " +     
              "WHERE BlockerID = #{blockerId} " +                                                                    
              "ORDER BY CreatedAt DESC")
      List<BlockedUser> getBlockedUsers(@Param("blockerId") Long blockerId);                                         
                                                                                                                     
      @Select("SELECT EXISTS(" +         
              "SELECT 1 FROM BlockedUsers " +                                                                        
              "WHERE BlockerID = #{blockerId} AND BlockedID = #{blockedId}" +                                        
              ")")                       
      boolean isBlocked(@Param("blockerId") Long blockerId,                                                          
                        @Param("blockedId") Long blockedId);                                                         
  }                                 