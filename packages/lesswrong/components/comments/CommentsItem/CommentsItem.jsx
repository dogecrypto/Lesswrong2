import { Components, getRawComponent, registerComponent, withMessages } from 'meteor/vulcan:core';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter, Link } from 'react-router';
import { FormattedMessage } from 'meteor/vulcan:i18n';
import { Posts } from "../../../lib/collections/posts";
import { Comments } from '../../../lib/collections/comments'
import Users from 'meteor/vulcan:users';
import classNames from 'classnames';
import Icon from '@material-ui/core/Icon';
import Tooltip from '@material-ui/core/Tooltip';
import { shallowEqual, shallowEqualExcept } from '../../../lib/modules/utils/componentUtils';
import { withStyles } from '@material-ui/core/styles';
import { commentBodyStyles } from '../../../themes/stylePiping'
import withErrorBoundary from '../../common/withErrorBoundary'

const styles = theme => ({
  root: {
    "&:hover $menu": {
      opacity:1
    }
  },
  commentStyling: {
    ...commentBodyStyles(theme)
  },
  author: {
    ...theme.typography.commentStyle,
    ...theme.typography.body2,
    fontWeight: 600,
  },
  postTitle: {
    marginRight: 5,
  },
  menu: {
    float:"right",
    opacity:.35,
    marginRight:-5
  },
})

class CommentsItem extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showReply: false,
      showEdit: false,
      showParent: false
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    if(!shallowEqual(this.state, nextState))
      return true;
    if(!shallowEqualExcept(this.props, nextProps, ["post", "editMutation"]))
      return true;
    return false;
  }

  showReply = (event) => {
    event.preventDefault();
    this.setState({showReply: true});
  }

  replyCancelCallback = () => {
    this.setState({showReply: false});
  }

  replySuccessCallback = () => {
    this.setState({showReply: false});
  }

  showEdit = () => {
    this.setState({showEdit: true});
  }

  editCancelCallback = () => {
    this.setState({showEdit: false});
  }

  editSuccessCallback = () => {
    this.setState({showEdit: false});
  }

  removeSuccessCallback = ({documentId}) => {
    this.props.flash({messageString: "Successfully deleted comment", type: "success"});
  }

  toggleShowParent = () => {
    this.setState({showParent:!this.state.showParent})
  }

  handleLinkClick = (event) => {
    const { comment, router } = this.props;
    event.preventDefault()
    this.props.router.replace({...router.location, hash: "#" + comment._id})
    this.props.scrollIntoView(event);
    return false;
  }

  getTruncationCharCount = () => {
    const { comment } = this.props
    return comment.baseScore > 20 ? 1000 : 300
  }

  render() {
    const { comment, currentUser, postPage, nestingLevel=1, showPostTitle, classes, post, truncated, collapsed, parentAnswerId } = this.props

    const { showEdit } = this.state
    const { CommentsMenu } = Components

    if (comment && post) {
      return (
        <div className={
          classNames(
            classes.root,
            "comments-item",
            "recent-comments-node",
            {
              deleted: comment.deleted && !comment.deletedPublic,
              "public-deleted": comment.deletedPublic,
              "showParent": this.state.showParent,
            },
          )}
        >

          { comment.parentCommentId && this.state.showParent && (
            <div className="recent-comment-parent root">
              <Components.RecentCommentsSingle
                currentUser={currentUser}
                documentId={comment.parentCommentId}
                level={nestingLevel + 1}
                truncated={false}
                key={comment.parentCommentId}
              />
            </div>
          )}

          <div className="comments-item-body">
            <div className="comments-item-meta">
              {(comment.parentCommentId && (parentAnswerId !== comment.parentCommentId) && (nestingLevel === 1)) &&
                <Tooltip title="Show previous comment">
                  <Icon
                    onClick={this.toggleShowParent}
                    className={classNames("material-icons","recent-comments-show-parent",{active:this.state.showParent})}
                  >
                    subdirectory_arrow_left
                  </Icon>
                </Tooltip>}
              { postPage && <a className="comments-collapse" onClick={this.props.toggleCollapse}>
                [<span>{this.props.collapsed ? "+" : "-"}</span>]
              </a>
              }
              { comment.deleted || comment.hideAuthor || !comment.user ?
                ((comment.hideAuthor || !comment.user) ? <span>[deleted]  </span> : <span> [comment deleted]  </span>) :
                <span className={classes.author}> <Components.UsersName user={comment.user}/> </span>
              }
              <div className="comments-item-date">
                { !postPage ?
                  <Link to={Posts.getPageUrl(post) + "#" + comment._id}>
                    <Components.FormatDate date={comment.postedAt}/>
                    <Icon className="material-icons comments-item-permalink"> link
                    </Icon>
                    {showPostTitle && post && post.title && <span className={classes.postTitle}> { post.title }</span>}
                  </Link>
                :
                <a href={Posts.getPageUrl(post) + "#" + comment._id} onClick={this.handleLinkClick}>
                  <Components.FormatDate date={comment.postedAt}/>
                  <Icon className="material-icons comments-item-permalink"> link
                  </Icon>
                  {showPostTitle && post && post.title && <span className={classes.postTitle}> { post.title }</span>}
                </a>
                }
              </div>
              <Components.CommentsVote comment={comment} currentUser={currentUser} />
              <span className={classes.menu}>
                <CommentsMenu
                  comment={comment}
                  post={post}
                  showEdit={this.showEdit}
                />
              </span>
            </div>
            { showEdit ? (
              <Components.CommentsEditForm
                  comment={comment}
                  successCallback={this.editSuccessCallback}
                  cancelCallback={this.editCancelCallback}
                />
            ) : (
              <Components.CommentBody
                truncationCharCount={this.getTruncationCharCount()}
                truncated={truncated}
                collapsed={collapsed}
                comment={comment}
              />
            ) }

            {!comment.deleted && !collapsed && this.renderCommentBottom()}
          </div>
          { this.state.showReply && !this.props.collapsed && this.renderReply() }
        </div>
      )
    } else {
      return null
    }
  }

  renderCommentBottom = () => {
    const { comment, currentUser, truncated, collapsed } = this.props;

    if ((!truncated || (comment.body.length <= this.getTruncationCharCount())) && !collapsed) {
      const blockedReplies = comment.repliesBlockedUntil && new Date(comment.repliesBlockedUntil) > new Date();

      const showReplyButton = (
        !comment.isDeleted &&
        !!currentUser &&
        (!blockedReplies || Users.canDo(currentUser,'comments.replyOnBlocked.all')) &&
        Users.isAllowedToComment(currentUser, this.props.post)
      )

      return (
        <div className="comments-item-bottom">
          { blockedReplies &&
            <div className="comment-blocked-replies">
              A moderator has deactivated replies on this comment until <Components.CalendarDate date={comment.repliesBlockedUntil}/>
            </div>
          }
          <div>
            { showReplyButton &&
              <a className="comments-item-reply-link" onClick={this.showReply}>
                <FormattedMessage id="comments.reply"/>
              </a>
            }
          </div>
        </div>
      )
    }
  }

  renderReply = () => {
    const levelClass = ((this.props.nestingLevel || 1) + 1) % 2 === 0 ? "comments-node-even" : "comments-node-odd"

    const { currentUser, post, comment, parentAnswerId } = this.props

    return (
      <div className={classNames("comments-item-reply", levelClass)}>
        <Components.CommentsNewForm
          postId={comment.postId}
          parentComment={comment}
          successCallback={this.replySuccessCallback}
          cancelCallback={this.replyCancelCallback}
          prefilledProps={{
            af:Comments.defaultToAlignment(currentUser, post, comment),
            parentAnswerId: parentAnswerId
          }}
          type="reply"
          parentAnswerId={parentAnswerId}
        />
      </div>
    )
  }
}

CommentsItem.propTypes = {
  currentUser: PropTypes.object,
  post: PropTypes.object.isRequired,
  comment: PropTypes.object.isRequired
}

registerComponent('CommentsItem', CommentsItem,
  withRouter, withMessages,
  withStyles(styles, { name: "CommentsItem" }),
  withErrorBoundary
);
export default CommentsItem;
