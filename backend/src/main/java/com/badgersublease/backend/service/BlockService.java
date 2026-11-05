package com.badgersublease.backend.service;

  import com.badgersublease.backend.mapper.BlockedUserMapper;
  import com.badgersublease.backend.mapper.ConversationMapper;
  import com.badgersublease.backend.mapper.UserMapper;                                                               
  import com.badgersublease.backend.model.BlockedUser;
  import com.badgersublease.backend.model.Conversation;                                                              
  import com.badgersublease.backend.model.User;
  import com.google.firebase.auth.UserRecord;                                                                        
  import org.slf4j.Logger;                                                                                           
  import org.slf4j.LoggerFactory;        
  import org.springframework.beans.factory.annotation.Autowired;                                                     
  import org.springframework.stereotype.Service;                                                                     
                                         
  import java.util.List;                                                                                             
         
  @Service                               
  public class BlockService {

      private static final Logger log = LoggerFactory.getLogger(BlockService.class);                                 
   
      private final BlockedUserMapper blockedUserMapper;                                                             
      private final ConversationMapper conversationMapper;
      private final UserMapper userMapper;                                                                           
      private final AuthService authService;
      private final SlackService slackService;

      @Autowired
      public BlockService(BlockedUserMapper blockedUserMapper,
                          ConversationMapper conversationMapper,
                          UserMapper userMapper,
                          AuthService authService,
                          SlackService slackService) {
          this.blockedUserMapper = blockedUserMapper;
          this.conversationMapper = conversationMapper;
          this.userMapper = userMapper;
          this.authService = authService;
          this.slackService = slackService;
      }  
                                                                                                                     
      public void blockUser(User blocker, Long blockedUserId) {
          if (blockedUserId == null) {                                                                               
              throw new IllegalArgumentException("blockedUserId is required");                                       
          }                              
          if (blockedUserId.equals(blocker.getUserID())) {                                                           
              throw new IllegalArgumentException("Cannot block yourself");                                           
          }                              
                                                                                                                     
          User target = userMapper.getUserById(blockedUserId);                                                       
          if (target == null) {          
              throw new RuntimeException("User not found");                                                          
          }
                                         
          blockedUserMapper.blockUser(blocker.getUserID(), blockedUserId);
          slackService.notifyUserBlocked(blocker.getUserID(), blockedUserId);                                        
   
          // Soft-delete any existing conversations between the two users for the blocker.                           
          // Reuses the DeletedConversations mechanism already used by "Delete Conversation".
          List<Conversation> conversations = conversationMapper.getUserConversations(blocker.getUserID());           
          for (Conversation c : conversations) {
              boolean involvesBlocked =                                                                              
                      blockedUserId.equals(c.getRequesterID()) ||
                      blockedUserId.equals(c.getListerID());                                                         
              if (involvesBlocked) {
                  conversationMapper.deleteConversationForUser(c.getConversationID(), blocker.getUserID());          
              }
          }                                                                                                          
      }  
                                         
      public void unblockUser(User blocker, Long blockedUserId) {                                                    
          if (blockedUserId == null) {
              throw new IllegalArgumentException("blockedUserId is required");                                       
          }
          blockedUserMapper.unblockUser(blocker.getUserID(), blockedUserId);
          // Intentionally does NOT restore the soft-deleted conversation.                                           
          // Matches existing delete semantics: a new message from either side                                       
          // will re-surface the conversation via conversationMapper.undeleteConversation.                           
      }                                                                                                              
                                                                                                                     
      public List<BlockedUser> getBlockedUsers(User blocker) {                                                       
          List<BlockedUser> rows = blockedUserMapper.getBlockedUsers(blocker.getUserID());
                                                                                                                     
          // Hydrate display name + avatar from Firebase (same pattern as                                            
          // MessageService.getUserConversations lines 60-72).                                                       
          for (BlockedUser row : rows) {                                                                             
              try {                                                                                                  
                  User blockedDbUser = userMapper.getUserById(row.getBlockedID());
                  if (blockedDbUser != null && blockedDbUser.getFirebaseUid() != null) {                             
                      UserRecord fb = authService.getUserByUid(blockedDbUser.getFirebaseUid());
                      if (fb != null) {                                                                              
                          row.setBlockedDisplayName(                                                                 
                                  fb.getDisplayName() != null ? fb.getDisplayName() : "Unknown User");               
                          row.setBlockedProfilePictureUrl(fb.getPhotoUrl());                                         
                      }                                                                                              
                  }                                                                                                  
              } catch (Exception e) {                                                                                
                  log.warn("Failed to hydrate blocked user {}: {}", row.getBlockedID(), e.getMessage());           
                  row.setBlockedDisplayName("Unknown User");                                                       
              }                                                                                                      
              if (row.getBlockedDisplayName() == null) {
                  row.setBlockedDisplayName("Unknown User");                                                         
              }
          }                                                                                                          
         
          return rows;                                                                                             
      }

      public boolean isBlocked(Long blockerId, Long blockedId) {                                                     
          if (blockerId == null || blockedId == null) return false;
          return blockedUserMapper.isBlocked(blockerId, blockedId);                                                  
      }                                                                                                              
  }                              