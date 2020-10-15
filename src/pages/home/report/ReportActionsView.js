import React from 'react';
import {View, Keyboard, ActivityIndicator} from 'react-native';
import PropTypes from 'prop-types';
import _ from 'underscore';
import lodashGet from 'lodash.get';
import Text from '../../../components/Text';
import withIon from '../../../components/withIon';
import {fetchActions, updateLastReadActionID} from '../../../libs/actions/Report';
import IONKEYS from '../../../IONKEYS';
import ReportActionItem from './ReportActionItem';
import styles, {colors} from '../../../styles/StyleSheet';
import ReportActionPropTypes from './ReportActionPropTypes';
import InvertedFlatList from '../../../components/InvertedFlatList';
import {lastItem} from '../../../libs/CollectionUtils';

const propTypes = {
    // The ID of the report actions will be created for
    reportID: PropTypes.number.isRequired,

    // Is this report currently in view?
    isActiveReport: PropTypes.bool.isRequired,

    /* Ion Props */

    reportActions: PropTypes.shape({
        // Map of report actions for this report
        actions: PropTypes.objectOf(PropTypes.shape(ReportActionPropTypes)),
        loading: PropTypes.bool,
    }),

    // The session of the logged in person
    session: PropTypes.shape({
        // Email of the logged in person
        email: PropTypes.string,
    }),
};

const defaultProps = {
    reportActions: {
        actions: {},
        loading: false,
    },
    session: {},
};

class ReportActionsView extends React.Component {
    constructor(props) {
        super(props);

        this.renderItem = this.renderItem.bind(this);
        this.scrollToListBottom = this.scrollToListBottom.bind(this);
        this.recordMaxAction = this.recordMaxAction.bind(this);
        this.sortedReportActions = this.updateSortedReportActions();
        this.debouncedLoadMore = _.debounce(() => this.loadMore(), 500);
    }

    componentDidMount() {
        if (this.props.isActiveReport) {
            this.keyboardEvent = Keyboard.addListener('keyboardDidShow', this.scrollToListBottom);
        }

        fetchActions(this.props.reportID);
    }

    componentDidUpdate(prevProps) {
        const actions = lodashGet(this.props, 'reportActions.actions');
        if (_.size(lodashGet(prevProps, 'reportActions.actions')) !== _.size(actions)) {
            // If a new comment is added and it's from the current user scroll to the bottom otherwise
            // leave the user positioned where they are now in the list.
            const lastAction = lastItem(actions);
            if (lastAction && (lastAction.actorEmail === this.props.session.email)) {
                this.scrollToListBottom();
            }

            // When the number of actions change, wait three seconds, then record the max action
            // This will make the unread indicator go away if you receive comments in the same chat you're looking at
            if (this.props.isActiveReport) {
                setTimeout(this.recordMaxAction, 3000);
            }

            return;
        }

        // If we are switching from not active to active report then mark comments as
        // read and bind the keyboard listener for this report
        if (!prevProps.isActiveReport && this.props.isActiveReport) {
            this.recordMaxAction();
            this.keyboardEvent = Keyboard.addListener('keyboardDidShow', this.scrollToListBottom);
        }
    }

    componentWillUnmount() {
        if (this.keyboardEvent) {
            this.keyboardEvent.remove();
        }
    }

    /**
     * Updates and sorts the report actions by sequence number
     */
    updateSortedReportActions() {
        const actions = lodashGet(this.props, 'reportActions.actions', {});
        this.sortedReportActions = _.chain(actions)
            .sortBy('sequenceNumber')
            .filter(action => action.actionName === 'ADDCOMMENT')
            .map((item, index) => ({action: item, index}))
            .value()
            .reverse();
    }

    /**
     * Returns true when the report action immediately before the
     * specified index is a comment made by the same actor who who
     * is leaving a comment in the action at the specified index.
     * Also checks to ensure that the comment is not too old to
     * be considered part of the same comment
     *
     * @param {Number} actionIndex - index of the comment item in state to check
     *
     * @return {Boolean}
     */
    isConsecutiveActionMadeByPreviousActor(actionIndex) {
        const previousAction = this.sortedReportActions[actionIndex + 1];
        const currentAction = this.sortedReportActions[actionIndex];

        // It's OK for there to be no previous action, and in that case, false will be returned
        // so that the comment isn't grouped
        if (!currentAction || !previousAction) {
            return false;
        }

        // Comments are only grouped if they happen within 5 minutes of each other
        if (currentAction.action.timestamp - previousAction.action.timestamp > 300) {
            return false;
        }

        return currentAction.action.actorEmail === previousAction.action.actorEmail;
    }

    /**
     * When the bottom of the list is reached, this is triggered, so it's a little different than recording the max
     * action when scrolled
     */
    recordMaxAction() {
        const reportActions = lodashGet(this.props, 'reportActions', {});
        const maxVisibleSequenceNumber = _.chain(reportActions)
            .pluck('sequenceNumber')
            .max()
            .value();

        updateLastReadActionID(this.props.reportID, maxVisibleSequenceNumber);
    }

    /**
     * This function is triggered from the ref callback for the scrollview. That way it can be scrolled once all the
     * items have been rendered. If the number of actions has changed since it was last rendered, then
     * scroll the list to the end.
     */
    scrollToListBottom() {
        if (this.actionListElement) {
            this.actionListElement.scrollToIndex({animated: false, index: 0});
        }
        this.recordMaxAction();
    }

    loadMore() {
        if (this.props.reportActions.loading) {
            return;
        }

        // Load the next set of report actions
        fetchActions(this.props.reportID);
    }

    /**
     * Do not move this or make it an anonymous function it is a method
     * so it will not be recreated each time we render an item
     *
     * See: https://reactnative.dev/docs/optimizing-flatlist-configuration#avoid-anonymous-function-on-renderitem
     *
     * @param {Object} args
     * @param {Object} args.item
     * @param {Number} args.index
     * @param {Function} args.onLayout
     * @param {Boolean} args.needsLayoutCalculation
     *
     * @returns {React.Component}
     */
    renderItem({
        item,
        index,
        onLayout,
        needsLayoutCalculation
    }) {
        return (
            <ReportActionItem
                action={item.action}
                displayAsGroup={this.isConsecutiveActionMadeByPreviousActor(index)}
                onLayout={onLayout}
                needsLayoutCalculation={needsLayoutCalculation}
            />
        );
    }

    render() {
        const actions = lodashGet(this.props, 'reportActions.actions', {});

        // Comments have not loaded at all yet do nothing
        if (!_.size(actions)) {
            return null;
        }

        // If we only have the created action then no one has left a comment
        if (_.size(actions) === 1) {
            return (
                <View style={[styles.chatContent, styles.chatContentEmpty]}>
                    <Text style={[styles.textP]}>Be the first person to comment!</Text>
                </View>
            );
        }

        this.updateSortedReportActions();
        return (
            <InvertedFlatList
                ref={el => this.actionListElement = el}
                data={this.sortedReportActions}
                renderItem={this.renderItem}
                contentContainerStyle={[styles.chatContentScrollView]}
                keyExtractor={item => `${item.action.sequenceNumber}`}
                initialRowHeight={32}
                ListFooterComponent={() => {
                    if (this.props.reportActions.loading) {
                        return (
                            <ActivityIndicator
                                size="large"
                                color={colors.textSupporting}
                            />
                        );
                    }

                    // Add some padding here so that the scroll position
                    // doesn't retrigger the loadMore method
                    return (
                        <View style={{height: 36}} />
                    );
                }}
                onScroll={({nativeEvent}) => {
                    const scrollTop = (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
                    if (scrollTop === nativeEvent.contentSize.height) {
                        this.debouncedLoadMore();
                    }
                }}
            />
        );
    }
}

ReportActionsView.propTypes = propTypes;
ReportActionsView.defaultProps = defaultProps;

export default withIon({
    reportActions: {
        key: ({reportID}) => `${IONKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`,
    },
    session: {
        key: IONKEYS.SESSION,
    },
})(ReportActionsView);
