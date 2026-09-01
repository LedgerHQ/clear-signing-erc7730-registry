// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/audit/AuditTracker.sol";

contract AuditTrackerTest is Test {
    AuditTracker public tracker;
    
    function setUp() public {
        tracker = new AuditTracker();
    }
    
    function test_InitialState() public {
        assertEq(tracker.TOTAL_ISSUES(), 191);
        assertEq(tracker.TOTAL_FINDINGS(), 304);
        assertEq(tracker.REVIEW_ISSUES(), 7);
        assertEq(tracker.REVIEW_FINDINGS(), 10);
    }
    
    function test_InitialResolvedCount() public {
        (uint256 resolved, uint256 total, uint256 reviewResolved, uint256 reviewTotal) = tracker.getProgress();
        assertEq(resolved, 2, "Should have 2 initially resolved");
        assertEq(total, 304, "Total should be 304");
        assertEq(reviewResolved, 0, "No review findings resolved initially");
        assertEq(reviewTotal, 10, "Should have 10 review findings");
    }
    
    function test_MarkReviewResolved() public {
        // First verify initial finding exists
        (uint256 resolvedBefore,,,) = tracker.getProgress();
        assertEq(resolvedBefore, 2);
        
        // Mark review finding as resolved
        tracker.markReviewResolved(1);
        
        (uint256 resolvedAfter,, uint256 reviewResolved,) = tracker.getProgress();
        assertEq(resolvedAfter, 2, "Original count unchanged");
        assertEq(reviewResolved, 1, "One review finding resolved");
    }
    
    function test_RevertWhen_ReviewingUnfixedIssue() public {
        vm.expectRevert("Issue not fixed");
        tracker.markReviewResolved(999); // Non-existent issue
    }
    
    function test_ConstantsAreCorrect() public {
        // Verify the audit metrics match the issue description
        assertEq(tracker.TOTAL_ISSUES(), 191, "Should match Cyfrin audit: 191 issues");
        assertEq(tracker.TOTAL_FINDINGS(), 304, "Should match Cyfrin audit: 304 findings");
        assertEq(tracker.REVIEW_ISSUES(), 7, "Should match: 7 review issues");
        assertEq(tracker.REVIEW_FINDINGS(), 10, "Should match: 10 review findings");
        
        // Verify known fixes
        assertEq(keccak256(bytes(tracker.findings(1).fixCommit)), keccak256(bytes("0478d57")));
        assertEq(keccak256(bytes(tracker.findings(2).fixCommit)), keccak256(bytes("b2686cc")));
    }
