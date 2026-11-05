 package com.badgersublease.backend.model;
                                                                                                                     
  import java.sql.Timestamp;
                                                                                                                     
  public class BlockedUser {
      private Long blockedUserID;        
      private Long blockerID;
      private Long blockedID;                                                                                        
      private Timestamp createdAt;
                                                                                                                     
      // Hydrated from Firebase in BlockService for the Privacy list response.                                       
      // Not columns in the DB.          
      private String blockedDisplayName;                                                                             
      private String blockedProfilePictureUrl;                                                                       
                                                                                                                     
      public Long getBlockedUserID() { return blockedUserID; }                                                       
      public void setBlockedUserID(Long blockedUserID) { this.blockedUserID = blockedUserID; }
                                                                                                                     
      public Long getBlockerID() { return blockerID; }                                                               
      public void setBlockerID(Long blockerID) { this.blockerID = blockerID; }
                                                                                                                     
      public Long getBlockedID() { return blockedID; }                                                               
      public void setBlockedID(Long blockedID) { this.blockedID = blockedID; }
                                                                                                                     
      public Timestamp getCreatedAt() { return createdAt; }
      public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
                                                                                                                     
      public String getBlockedDisplayName() { return blockedDisplayName; }
      public void setBlockedDisplayName(String blockedDisplayName) { this.blockedDisplayName = blockedDisplayName; } 
                                                                                                                     
      public String getBlockedProfilePictureUrl() { return blockedProfilePictureUrl; }                               
      public void setBlockedProfilePictureUrl(String blockedProfilePictureUrl) { this.blockedProfilePictureUrl =     
  blockedProfilePictureUrl; }                                                                                        
  }       