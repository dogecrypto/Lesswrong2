/*

Posts schema

*/

import Users from 'meteor/vulcan:users';
import { Utils, /*getSetting,*/ registerSetting, getCollection } from 'meteor/vulcan:core';
import moment from 'moment';
import { generateIdResolverSingle } from '../../modules/utils/schemaUtils'

registerSetting('forum.postExcerptLength', 30, 'Length of posts excerpts in words');

/**
 * @summary Posts config namespace
 * @type {Object}
 */
const formGroups = {
  // TODO - Figure out why properly moving this from custom_fields to schema was producing weird errors and then fix it
  adminOptions: {
    name: "adminOptions",
    order: 25,
    label: "Admin Options",
    startCollapsed: true,
  },
};

/**
 * @summary Posts schema
 * @type {Object}
 */
const schema = {
  /**
    ID
  */
  _id: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
  },
  /**
    Timetstamp of post creation
  */
  createdAt: {
    type: Date,
    optional: true,
    viewableBy: ['admins'],
    onInsert: () => {
      return new Date();
    }
  },
  /**
    Timestamp of post first appearing on the site (i.e. being approved)
  */
  postedAt: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
    insertableBy: ['admins'],
    editableBy: ['admins'],
    control: 'datetime',
    group: formGroups.adminOptions,
    onInsert: (post, currentUser) => {
      // Set the post's postedAt if it's going to be approved
      if (!post.postedAt && getCollection('Posts').getDefaultStatus(currentUser) === getCollection('Posts').config.STATUS_APPROVED) {
        return new Date();
      }
    },
    onEdit: (modifier, post) => {
      // Set the post's postedAt if it's going to be approved
      if (!post.postedAt && modifier.$set.status === getCollection('Posts').config.STATUS_APPROVED) {
        return new Date();
      }
    }
  },
  /**
    URL
  */
  url: {
    type: String,
    optional: true,
    max: 500,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [Users.owns, 'sunshineRegiment', 'admins'],
    control: 'url',
    order: 10,
    searchable: true,
    query: `
      SiteData{
        logoUrl
        title
      }
    `,
  },
  /**
    Title
  */
  title: {
    type: String,
    optional: false,
    max: 500,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [Users.owns, 'sunshineRegiment', 'admins'],
    control: 'text',
    order: 20,
    searchable: true
  },
  /**
    Slug
  */
  slug: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    onInsert: (post) => {
      return Utils.slugify(post.title);
    },
    onEdit: (modifier, post) => {
      if (modifier.$set.title) {
        return Utils.slugify(modifier.$set.title);
      }
    }
  },
  /**
    Post body (markdown)
  */
  body: {
    type: String,
    optional: true,
    max: 3000,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [Users.owns, 'sunshineRegiment', 'admins'],
    control: 'textarea',
    order: 30
  },
  /**
    HTML version of the post body
  */
  htmlBody: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    // LESSWRONG: DEACTIVATED THESE SINCE WE ARE DOING OUR OWN
    // onInsert: (post) => {
    //   if (post.body) {
    //     return Utils.sanitize(marked(post.body));
    //   }
    // },
    // onEdit: (modifier, post) => {
    //   if (modifier.$set.body) {
    //     return Utils.sanitize(marked(modifier.$set.body));
    //   }
    // }
  },
  /**
   Post Excerpt
   */
  excerpt: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    searchable: true,
    // LESSWRONG: DEACTIVATED THESE SINCE WE ARE DOING OUR OWN
    // onInsert: (post) => {
    //   if (post.body) {
    //     // excerpt length is configurable via the settings (30 words by default, ~255 characters)
    //     const excerptLength = getSetting('forum.postExcerptLength', 30);
    //     return Utils.trimHTML(Utils.sanitize(marked(post.body)), excerptLength);
    //   }
    // },
    // onEdit: (modifier, post) => {
    //   if (modifier.$set.body) {
    //     const excerptLength = getSetting('forum.postExcerptLength', 30);
    //     return Utils.trimHTML(Utils.sanitize(marked(modifier.$set.body)), excerptLength);
    //   }
    // }
  },
  /**
    Count of how many times the post's page was viewed
  */
  viewCount: {
    type: Number,
    optional: true,
    viewableBy: ['admins'],
    defaultValue: 0
  },
  /**
    Timestamp of the last comment
  */
  lastCommentedAt: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
  },
  /**
    Count of how many times the post's link was clicked
  */
  clickCount: {
    type: Number,
    optional: true,
    viewableBy: ['admins'],
    defaultValue: 0
  },
  /**
    The post's status. One of pending (`1`), approved (`2`), rejected (`3`), spam (`4`) or deleted (`5`)
  */
  status: {
    type: Number,
    optional: true,
    viewableBy: ['guests'],
    insertableBy: ['admins'],
    editableBy: ['admins'],
    control: 'select',
    onInsert: (document, currentUser) => {
      if (!document.status) {
        return getCollection('Posts').getDefaultStatus(currentUser);
      }
    },
    onEdit: (modifier, document, currentUser) => {
      // if for some reason post status has been removed, give it default status
      if (modifier.$unset && modifier.$unset.status) {
        return getCollection('Posts').getDefaultStatus(currentUser);
      }
    },
    options: () => getCollection('Posts').statuses,
    group: formGroups.adminOptions
  },
  /**
    Whether a post is scheduled in the future or not
  */
  isFuture: {
    type: Boolean,
    optional: true,
    viewableBy: ['guests'],
    onInsert: (post) => {
      // Set the post's isFuture to true if necessary
      if (post.postedAt) {
        const postTime = new Date(post.postedAt).getTime();
        const currentTime = new Date().getTime() + 1000;
        return postTime > currentTime; // round up to the second
      }
    },
    onEdit: (modifier, post) => {
      // Set the post's isFuture to true if necessary
      if (modifier.$set.postedAt) {
        const postTime = new Date(modifier.$set.postedAt).getTime();
        const currentTime = new Date().getTime() + 1000;
        if (postTime > currentTime) {
          // if a post's postedAt date is in the future, set isFuture to true
          return true;
        } else if (post.isFuture) {
          // else if a post has isFuture to true but its date is in the past, set isFuture to false
          return false;
        }
      }
    }
  },
  /**
    Whether the post is sticky (pinned to the top of posts lists)
  */
  sticky: {
    type: Boolean,
    optional: true,
    defaultValue: false,
    viewableBy: ['guests'],
    insertableBy: ['admins'],
    editableBy: ['admins'],
    control: 'checkbox',
    group: formGroups.adminOptions,
    onInsert: (post) => {
      if(!post.sticky) {
        return false;
      }
    },
    onEdit: (modifier, post) => {
      if (!modifier.$set.sticky) {
        return false;
      }
    }
  },
  /**
    Save info for later spam checking on a post. We will use this for the akismet package
  */
  userIP: {
    type: String,
    optional: true,
    viewableBy: ['admins'],
  },
  userAgent: {
    type: String,
    optional: true,
    viewableBy: ['admins'],
  },
  referrer: {
    type: String,
    optional: true,
    viewableBy: ['admins'],
  },
  /**
    The post author's name
  */
  author: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    onEdit: (modifier, document, currentUser) => {
      // if userId is changing, change the author name too
      if (modifier.$set && modifier.$set.userId) {
        return Users.getDisplayNameById(modifier.$set.userId)
      }
    }
  },
  /**
    The post author's `_id`.
  */
  userId: {
    type: String,
    optional: true,
    control: 'select',
    viewableBy: ['guests'],
    insertableBy: ['members'],
    hidden: true,
    resolveAs: {
      fieldName: 'user',
      type: 'User',
      resolver: generateIdResolverSingle(
        {collectionName: 'Users', fieldName: 'userId'}
      ),
      addOriginalField: true
    },
  },

  /**
    Used to keep track of when a post has been included in a newsletter
  */
  scheduledAt: {
    type: Date,
    optional: true,
    viewableBy: ['admins'],
  },

  // GraphQL-only fields

  domain: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, context) => {
        return Utils.getDomain(post.url);
      },
    }
  },

  pageUrl: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, { Posts }) => {
        return Posts.getPageUrl(post, true);
      },
    }
  },

  linkUrl: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, { Posts }) => {
        return post.url ? Utils.getOutgoingUrl(post.url) : Posts.getPageUrl(post, true);
      },
    }
  },

  postedAtFormatted: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, context) => {
        return moment(post.postedAt).format('dddd, MMMM Do YYYY');
      }
    }
  },

  commentsCount: {
    type: Number,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'Int',
      resolver: (post, args, { Comments }) => {
        const commentsCount = Comments.find({ postId: post._id }).count();
        return commentsCount;
      },
    }
  },

  commentIds: {
    type: Object,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      fieldName: 'comments',
      arguments: 'limit: Int = 5',
      type: '[Comment]',
      resolver: generateIdResolverSingle(
        {collectionName: 'Comments', fieldName: 'commentIds'}
      ),
    }
  },

  emailShareUrl: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, { Posts }) => {
        return Posts.getEmailShareUrl(post);
      }
    }
  },

  twitterShareUrl: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, { Posts }) => {
        return Posts.getTwitterShareUrl(post);
      }
    }
  },

  facebookShareUrl: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'String',
      resolver: (post, args, { Posts }) => {
        return Posts.getFacebookShareUrl(post);
      }
    }
  },

  question: {
    type: Boolean,
    optional: true,
    defaultValue: false,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    hidden: true,
  },

  authorIsUnreviewed: {
    type: Boolean,
    optional: true,
    defaultValue: false,
    viewableBy: ['guests'],
    insertableBy: ['admins', 'sunshineRegiment'],
    editableBy: ['admins', 'sunshineRegiment'],
    group: formGroups.adminOptions,
  },

};

export default schema;
