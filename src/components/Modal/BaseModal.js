import React, {PureComponent} from 'react';
import {View} from 'react-native';
import ReactNativeModal from 'react-native-modal';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import KeyboardShortcut from '../../libs/KeyboardShortcut';
import styles, {getSafeAreaPadding} from '../../styles/styles';
import themeColors from '../../styles/themes/default';
import {propTypes, defaultProps} from './ModalPropTypes';
import getModalStyles from '../../styles/getModalStyles';

class BaseModal extends PureComponent {
    constructor(props) {
        super(props);

        this.subscribeToKeyEvents = this.subscribeToKeyEvents.bind(this);
        this.unsubscribeFromKeyEvents = this.unsubscribeFromKeyEvents.bind(this);
    }

    componentWillUnmount() {
        this.unsubscribeFromKeyEvents();
    }

    subscribeToKeyEvents() {
        KeyboardShortcut.subscribe('Escape', this.props.onClose, [], true);
        KeyboardShortcut.subscribe('Enter', this.props.onSubmit, [], true);
    }

    unsubscribeFromKeyEvents() {
        KeyboardShortcut.unsubscribe('Escape');
        KeyboardShortcut.unsubscribe('Enter');
    }

    render() {
        const {
            modalStyle,
            modalContainerStyle,
            swipeDirection,
            animationIn,
            animationOut,
            shouldAddTopSafeAreaPadding,
            shouldAddBottomSafeAreaPadding,
            hideBackdrop,
        } = getModalStyles(
            this.props.type,
            {
                windowWidth: this.props.windowWidth,
                windowHeight: this.props.windowHeight,
                isSmallScreenWidth: this.props.isSmallScreenWidth,
            },
            this.props.popoverAnchorPosition,
        );
        return (
            <ReactNativeModal
                onBackdropPress={this.props.onClose}
                onBackButtonPress={this.props.onClose}
                onModalShow={this.subscribeToKeyEvents}
                onModalHide={() => {
                    this.unsubscribeFromKeyEvents();
                    this.props.onModalHide();
                }}
                onSwipeComplete={this.props.onClose}
                swipeDirection={swipeDirection}
                isVisible={this.props.isVisible}
                backdropColor={themeColors.modalBackdrop}
                backdropOpacity={hideBackdrop ? 0 : 0.5}
                backdropTransitionOutTiming={0}
                style={modalStyle}
                deviceHeight={this.props.windowHeight}
                deviceWidth={this.props.windowWidth}
                animationIn={animationIn}
                animationOut={animationOut}
                useNativeDriver={this.props.useNativeDriver}
                statusBarTranslucent
            >
                <SafeAreaInsetsContext.Consumer>
                    {(insets) => {
                        const {
                            paddingTop: safeAreaPaddingTop,
                            paddingBottom: safeAreaPaddingBottom,
                        } = getSafeAreaPadding(insets);

                        return (
                            <View
                                style={{
                                    ...styles.defaultModalContainer,
                                    ...modalContainerStyle,
                                    paddingTop: shouldAddTopSafeAreaPadding
                                        ? (modalContainerStyle.paddingTop || 0) + safeAreaPaddingTop
                                        : modalContainerStyle.paddingTop || 0,
                                    paddingBottom: shouldAddBottomSafeAreaPadding
                                        ? (modalContainerStyle.paddingBottom || 0) + safeAreaPaddingBottom
                                        : modalContainerStyle.paddingBottom || 0,
                                }}
                            >
                                {this.props.children}
                            </View>
                        );
                    }}
                </SafeAreaInsetsContext.Consumer>
            </ReactNativeModal>
        );
    }
}

BaseModal.propTypes = propTypes;
BaseModal.defaultProps = defaultProps;
BaseModal.displayName = 'BaseModal';
export default BaseModal;
